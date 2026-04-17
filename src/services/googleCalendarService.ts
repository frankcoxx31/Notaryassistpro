import { google } from 'googleapis';
import path from 'path';

/**
 * Ensures the date and time strings are correctly parsed into a Date object.
 * Adjust this if your date/time formats are different.
 */
function parseDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Basic handling for "14:00" or "2:00 PM"
  let parsedTime = timeStr.trim();
  let hours = 0;
  let minutes = 0;
  
  const isPM = parsedTime.toUpperCase().includes('PM');
  const isAM = parsedTime.toUpperCase().includes('AM');
  parsedTime = parsedTime.replace(/PM|AM/i, '').trim();
  
  const timeParts = parsedTime.split(':');
  hours = parseInt(timeParts[0], 10);
  minutes = timeParts[1] ? parseInt(timeParts[1], 10) : 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  // Returning the exact local time (Assuming the server matches the timezone, 
  // or you can append timezone offsets if needed)
  return new Date(year, month - 1, day, hours, minutes);
}

export interface SigningDetails {
  clientName: string;
  address: string;
  signingDate: string; // e.g., '2026-04-18'
  signingTime: string; // e.g., '2:00 PM'
}

/**
 * Triggers whenever a new signing is saved. Uses Google Calendar API
 * and a Service Account to create an event automatically.
 */
export async function createNotarySigning(details: SigningDetails): Promise<string | null> {
  const { clientName, address, signingDate, signingTime } = details;

  try {
    // 1. Initialize Service Account Auth
    // Point this to your downloaded service-account.json file
    const KEYFILEPATH = path.join(process.cwd(), 'service-account.json');
    const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

    const auth = new google.auth.GoogleAuth({
      keyFile: KEYFILEPATH,
      scopes: SCOPES,
    });

    // 2. Initialize the Calendar API client
    const calendar = google.calendar({ version: 'v3', auth });

    // 3. Format Date/Times
    const startDate = parseDateTime(signingDate, signingTime);
    
    // Default duration to 60 minutes
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    // 4. Construct Event Payload
    const event = {
      summary: `Signing: ${clientName}`,
      location: address,
      description: `Automated Notary Signing appointment for ${clientName}.\\nLocation: ${address}`,
      start: {
        dateTime: startDate.toISOString(),
      },
      end: {
        dateTime: endDate.toISOString(),
      },
    };

    // 5. Insert the Event into Google Calendar
    // Use 'primary' if the service account calendar is shared with your personal calendar,
    // or provide a specific Calendar ID from your Google Calendar settings.
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    console.log(`Creating calendar event for ${clientName}...`);
    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: event,
    });

    console.log('Event created successfully:', response.data.htmlLink);
    return response.data.id || null;

  } catch (error: any) {
    // 6. Comprehensive Error Handling
    console.error('Failed to create Google Calendar event:');
    
    if (error.code === 403) {
      console.error('Error 403: Quota exceeded or permission denied.');
      console.error('Verify your Service Account has access to the target calendar.');
    } else if (error.code === 404) {
      console.error('Error 404: Calendar ID not found. Check your GOOGLE_CALENDAR_ID.');
    } else if (error.code >= 500) {
      console.error('Error 5xx: Google Calendar API is currently down or unreachable.');
    } else {
      console.error('Unknown API Error:', error.message);
    }

    // You can choose to re-throw the error or handle it gracefully depending on your app's flow
    throw new Error(`Calendar Sync Failed: ${error.message}`);
  }
}
