import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import fs from "fs";
import { google } from "googleapis";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function startServer() {
  console.log("Starting server process...");
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const rootDir = process.cwd();

  // Initialize Firebase and Google OAuth inside startServer to avoid top-level crashes
  let firestore: any;
  let oauth2Client: any;

  // Setup Service Account Auth globally if available
  let serviceAccountAuth: any;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    console.log("Setting up Service Account Auth for Google Calendar...");
    try {
      // Handle the case where the private key might be escaped in the env var
      const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
      serviceAccountAuth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/calendar.events']
      });
    } catch (e) {
      console.error("Failed to initialize Service Account Auth:", e);
    }
  }

    try {
      const configPath = path.join(rootDir, "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        console.log("Loading Firebase config from:", configPath);
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: firebaseConfig.projectId,
          });
          console.log("Firebase Admin initialized for project:", firebaseConfig.projectId);
        }
        firestore = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);
      } else {
        console.warn("firebase-applet-config.json not found");
      }
    } catch (error) {
      console.error("Firebase initialization error:", error);
    }

    try {
      console.log("Setting up Google OAuth client...");
      if (process.env.GOOGLE_CLIENT_ID) {
        oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
      } else {
        console.warn("GOOGLE_CLIENT_ID is missing from environment variables.");
      }
    } catch (error) {
      console.error("Google OAuth initialization error:", error);
    }

  app.use(compression());
  app.use(express.json());
  app.use(cookieParser());

  // Health check should be very robust
  app.get("/api/health", (req, res) => {
    console.log("Health check request received");
    res.json({ 
      status: "ok", 
      time: new Date().toISOString(),
      firebaseInit: !!firestore,
      googleInit: !!oauth2Client,
      serviceAccountInit: !!serviceAccountAuth,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null
    });
  });

  // --- Google Calendar OAuth ---
  app.get("/api/auth/google", (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).send("UID required");

    if (!oauth2Client) {
      console.error("Google OAuth client not initialized. Check your environment variables.");
      return res.status(503).send("Google Calendar integration is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables.");
    }

    const scopes = [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/calendar.events"
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: uid as string,
    });

    res.redirect(url);
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, state: uid } = req.query;
    if (!code || !uid) return res.status(400).send("Code and UID required");

    if (!oauth2Client) {
      return res.status(503).send("Google OAuth client not initialized");
    }

    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      
      // Pass tokens directly to frontend - frontend will save it
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, window.location.origin);
              window.close();
            </script>
            <p>Authentication successful! You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Authentication failed");
    }
  });

  function getGoogleCalendarDateTime(dateStr: string = '', timeStr: string = '') {
    if (!dateStr) return { start: new Date().toISOString(), end: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
    
    let year = new Date().getFullYear(), month = new Date().getMonth() + 1, day = new Date().getDate();
    
    // Handle YYYY-MM-DD
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      }
    } 
    // Handle M/D/YYYY or MM/DD/YYYY
    else if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        month = parseInt(parts[0], 10);
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
      }
    }

    const time24 = convertTo24(timeStr);
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);

    // Format like "2026-04-18T10:00:00" without the strict 'Z' offset.
    // By providing this format combined with timeZone, Google infers local time correctly.
    const pad = (n: number) => String(n).padStart(2, '0');
    const startStr = `${year}-${pad(month)}-${pad(day)}T${pad(h)}:${pad(m)}:00`;
    
    // Add 1 hour for end time
    let endH = h + 1;
    let endDay = day;
    // VERY simple overflow for 24h, you might need a heavier library if you want to perfectly roll over months/years
    if (endH >= 24) { endH -= 24; endDay += 1; }
    
    const endStr = `${year}-${pad(month)}-${pad(endDay)}T${pad(endH)}:${pad(m)}:00`;
    
    return { start: startStr, end: endStr };
  }

  app.post("/api/calendar/sync", async (req, res) => {
    const { appointmentId, uid, action, appointmentData, googleCalendarTokens } = req.body;
    if (!appointmentId || !uid || !appointmentData) return res.status(400).json({ error: "Missing fields" });

    try {
      // Determine Auth Method & Calendar ID
      let auth: any;
      let calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

      if (serviceAccountAuth) {
        console.log("Using Service Account auth for sync...");
        auth = serviceAccountAuth;
      } else {
        // Fallback to OAuth2
        const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
        if (!GOOGLE_CLIENT_ID) {
          return res.status(503).json({ error: "Google OAuth credentials missing" });
        }
        
        const tokens = googleCalendarTokens;
        if (!tokens) return res.status(401).json({ error: "Google Calendar not connected" });

        const oauth2 = new google.auth.OAuth2(
          GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET,
          GOOGLE_REDIRECT_URI
        );
        oauth2.setCredentials(tokens);

        // We can't save to firestore securely here; if refresh needed, we'll return the new tokens to client
        let newTokensData: any = null;
        oauth2.on("tokens", (newTokens) => {
          newTokensData = { ...tokens, ...newTokens };
        });
        auth = oauth2;
      }

      const appointment = appointmentData;
      const calendar = google.calendar({ version: "v3", auth });

      if (action === 'delete') {
        const eventId = req.body.eventId || appointment?.googleCalendarEventId;
        if (eventId) {
          try {
            await calendar.events.delete({
              calendarId,
              eventId: eventId,
            });
          } catch (e: any) {
            if (e.code !== 404) throw e;
          }
        }
        return res.json({ status: "deleted" });
      }

      const { start: startDateTime, end: endDateTime } = getGoogleCalendarDateTime(appointment?.date, appointment?.time);

      const event = {
        summary: `${appointment?.signingType || 'Signing'}: ${appointment?.customerName || appointment?.clientName || 'Unknown Client'}`,
        location: appointment?.location || appointment?.address || 'TBD',
        description: `
Client: ${appointment?.customerName || appointment?.clientName || 'N/A'}
Type: ${appointment?.signingType || 'N/A'}
Documents: ${(appointment?.docs || []).join(', ')}
Notes: ${appointment?.notes || ''}
Phone: ${appointment?.phone || ''}
Order #: ${appointment?.orderNumber || ''}
Link: ${process.env.APP_URL || ''}/appointments?id=${appointmentId}
      `.trim(),
        start: {
          dateTime: startDateTime,
          timeZone: "America/New_York",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "America/New_York",
        },
      };

      console.log(`[Calendar Sync] Syncing to Calendar ID: ${calendarId}`);
      console.log(`[Calendar Sync] Event Data:`, JSON.stringify(event, null, 2));

      if (appointment?.googleCalendarEventId) {
        // Update existing event
        try {
          console.log(`[Google API Request] (Update) ID: ${appointment.googleCalendarEventId}`, {
            calendarId,
            summary: event.summary,
            start: event.start.dateTime,
            end: event.end.dateTime
          });
          const apiResponse = await calendar.events.update({
            calendarId,
            eventId: appointment.googleCalendarEventId,
            requestBody: event,
          });
          console.log(`[Google API Response] Success (Update)`, JSON.stringify(apiResponse.data, null, 2));
          res.json({ 
            status: "updated", 
            googleResponse: apiResponse.data,
            sentEvent: event,
            calendarIdUsed: calendarId
          });
        } catch (error: any) {
          if (error.code === 404) {
             // If event not found, re-create it
             console.log(`[Google API] Event ${appointment.googleCalendarEventId} not found, re-creating...`);
             const newEvent = await calendar.events.insert({
                calendarId,
                requestBody: event,
              });
              console.log(`[Google API Response] Success (Re-create)`, JSON.stringify(newEvent.data, null, 2));
              res.json({ 
                status: "re-created", 
                eventId: newEvent.data.id, 
                googleResponse: newEvent.data,
                sentEvent: event,
                calendarIdUsed: calendarId
              });
          } else {
            throw error;
          }
        }
      } else {
        // Create new event
        console.log(`[Google API Request] (Insert)`, {
          calendarId,
          summary: event.summary,
          start: event.start.dateTime,
          end: event.end.dateTime
        });
        const newEvent = await calendar.events.insert({
          calendarId,
          requestBody: event,
        });
        console.log(`[Google API Response] Success (Create)`, JSON.stringify(newEvent.data, null, 2));
        res.json({ 
          status: "created", 
          eventId: newEvent.data.id, 
          googleResponse: newEvent.data,
          sentEvent: event,
          calendarIdUsed: calendarId
        });
      }

    } catch (error: any) {
      console.error("Calendar Sync Error:", error);
      const errorMessage = error.response?.data?.error?.message || error.message || "Unknown calendar error";
      res.status(500).json({ 
        error: "Failed to sync calendar", 
        details: errorMessage,
        code: error.code || error.response?.status
      });
    }
  });

  function convertTo24(time12h: string = '10:00 AM') {
    if (!time12h) return "10:00";
    
    // Normalize string: ensure space before AM/PM
    const normalized = time12h.replace(/([0-9])([AP]M)/i, '$1 $2').trim();
    const [time, modifier] = normalized.split(' ');
    
    let [hours, minutes] = time.split(':');
    if (!hours) hours = '10';
    if (!minutes) minutes = '00';
    
    if (hours === '12') {
      hours = (modifier === 'AM' || !modifier) ? '00' : '12';
    } else if (modifier === 'PM') {
      hours = String(parseInt(hours, 10) + 12);
    }
    
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  }

  function parseSafeDate(dateStr: string = '', timeStr: string = ''): Date {
    try {
      if (!dateStr) return new Date();
      
      let year = 0, month = 0, day = 0;
      
      // Handle YYYY-MM-DD
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[2], 10);
        }
      } 
      // Handle M/D/YYYY or MM/DD/YYYY
      else if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          month = parseInt(parts[0], 10) - 1;
          day = parseInt(parts[1], 10);
          year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
        }
      }

      const time24 = convertTo24(timeStr);
      const [h, m] = time24.split(':');
      
      const date = new Date(year, month, day, parseInt(h, 10), parseInt(m, 10));
      if (isNaN(date.getTime())) throw new Error("Invalid date components");
      return date;
    } catch (e) {
      console.error("Error parsing date in server:", dateStr, timeStr, e);
      return new Date();
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const rootDir = process.cwd();
    const distPath = path.join(rootDir, 'dist');
    
    // Check if dist folder exists
    if (!fs.existsSync(distPath)) {
      console.error(`ERROR: 'dist' folder not found at ${distPath}.`);
    }

    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error("Error sending index.html:", err);
          res.status(503).send(`Application Error: index.html not found. Path: ${indexPath}`);
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
