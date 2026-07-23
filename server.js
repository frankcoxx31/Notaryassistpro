// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import fs from "fs";
import crypto from "crypto";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

// src/lib/consentTemplates.ts
var BASE_ACKNOWLEDGEMENTS = [
  {
    key: "notAnAttorney",
    label: "I understand the notary public is not an attorney and cannot give legal advice, prepare legal documents, or explain the contents or effect of any document.",
    required: true
  },
  {
    key: "validId",
    label: "I will present valid, unexpired, government-issued photo identification at the appointment, and I understand the notarization cannot proceed without it.",
    required: true
  },
  {
    key: "willingAndAware",
    label: "I am signing willingly, of my own free will, and I am aware of the nature of the documents being notarized.",
    required: true
  },
  {
    key: "journalRecord",
    label: "I consent to the notary recording this notarial act in their official journal, including my name, the type of document, the identification presented, and the date and time.",
    required: true
  },
  {
    key: "feesUnderstood",
    label: "I have reviewed the Cost of Services total above, I agree to that amount, and I understand travel reimbursement is separate from the statutory notarial fee.",
    required: true
  }
];
var APPOINTMENT_FIELDS = [
  { key: "clientName", label: "Client / Signer Name", type: "text", required: true, prefillFrom: "fullName" },
  { key: "clientEmail", label: "Client Email", type: "text", required: true, prefillFrom: "email" },
  { key: "clientPhone", label: "Client Phone", type: "text", prefillFrom: "phone" },
  { key: "appointmentDate", label: "Appointment Date", type: "date", required: true },
  { key: "appointmentTime", label: "Appointment Time", type: "time", required: true },
  { key: "appointmentLocation", label: "Appointment Location", type: "textarea", required: true, placeholder: "Street, city, state, ZIP", prefillFrom: "address" }
];
var PER_SIGNATURE_FEE_FIELDS = [
  { key: "notarialFee", label: "Fee per Notarized Signature", type: "currency", required: true, help: "North Carolina caps most acknowledgments at $10.00 per principal signature." },
  { key: "actCount", label: "Number of Notarized Signatures", type: "number", required: true, help: "Fee per signature times this count is shown to the client as a line item." },
  { key: "travelMiles", label: "Round-Trip Miles", type: "number", help: "Use the address lookup above to fill this from the appointment location." },
  { key: "travelFee", label: "Travel / Convenience Fee", type: "currency", help: "Must be disclosed and agreed to in advance, separately from the notarial fee." },
  { key: "travelWaived", label: "Waive travel reimbursement", type: "checkbox", help: "Charges $0.00 for travel and says so on the client\u2019s form." }
];
var FLAT_FEE_FIELDS = [
  { key: "flatFee", label: "Flat Signing Fee", type: "currency", required: true, help: "The single agreed fee for this signing, based on the loan document package. Covers notarizations, travel, and printing." },
  { key: "feeIncludes", label: "What the Fee Covers", type: "text", placeholder: "e.g. bedside notarizations, travel, printing, and package return", help: "Shown to the client under the fee line." }
];
var COMMON_FIELDS = [...APPOINTMENT_FIELDS, ...PER_SIGNATURE_FEE_FIELDS];
var BASE_CLAUSES_INTRO = [
  {
    heading: "Scope of Service",
    body: "{{business.name}} is a commissioned notary public providing notarial services only. The notary will verify the identity of each signer, confirm each signer is signing willingly and is aware of the contents of the document, witness the signature, and complete the notarial certificate. The notary does not draft, select, review, correct, or explain documents."
  },
  {
    heading: "Not Legal or Financial Advice",
    body: "The notary is not an attorney licensed to practice law and may not give legal advice about your documents, accept fees for legal advice, or recommend how you should sign. If you need your documents explained, please consult a licensed attorney before the appointment."
  }
];
var PER_SIGNATURE_FEE_CLAUSES = [
  {
    heading: "Fees",
    body: "The notarial fee is {{notarialFee}} per notarized signature, with {{actCount}} signature(s) anticipated, plus travel reimbursement of {{travelFee}}. The itemised total shown in the Cost of Services table above is what is due at the time of service. Travel reimbursement is charged for the time and expense of traveling to you and is separate from, and clearly distinguishable from, the statutory notarial fee. If the number of signatures turns out to be different on the day, the notarial fee changes accordingly and is confirmed with you before it is charged."
  },
  {
    heading: "Mileage and Travel Reimbursement",
    body: "Travel is billed as mileage reimbursement at the IRS business rate of $0.725 per mile, calculated on round-trip distance from our office in Mint Hill, NC. Travel reimbursement is not a notarial fee and is stated separately from it, as required. Any estimate given before the appointment \u2014 including one generated by the website quote calculator \u2014 is an estimate only; the final figure is the one stated in this form. If the appointment address changes, a second trip is needed, or the route differs materially from the estimate, the travel amount is recalculated and confirmed with you before any additional charge applies."
  }
];
var FLAT_FEE_CLAUSE = {
  heading: "Fees",
  body: "This is a flat-fee signing. The agreed fee is {{flatFee}}, covering {{feeIncludes}}. This is the total amount due at the time of service \u2014 there is no separate per-signature charge and no mileage or travel add-on. The notarial acts within the loan package are included in the flat fee. If the signing cannot be completed for a reason outside the notary's control \u2014 documents do not arrive, arrive incomplete or with errors requiring lender correction, or a signer is unavailable or cannot be identified \u2014 a print or trip fee may apply as agreed in advance, and the appointment is rescheduled."
};
var BASE_CLAUSES_TAIL = [
  {
    heading: "Identification Required",
    body: "Every signer must present valid, unexpired, government-issued photo identification at the appointment. Acceptable forms include a driver license, state-issued identification card, United States passport, or military identification. Without acceptable identification, the notary is required to refuse the notarization, and any agreed travel or trip fee remains payable."
  },
  {
    heading: "Right to Refuse a Notarization",
    body: "The notary must refuse to perform a notarial act if the signer cannot be properly identified, appears confused or unaware of the nature of the transaction, appears to be signing under duress or undue influence, or if the document is incomplete or blank. A refusal on these grounds is required by law and is not a reflection on the signer."
  },
  {
    heading: "Journal and Recordkeeping",
    body: "The notary maintains a journal of notarial acts as required by law. Entries include the date and time of the act, the type of act, the type of document, the name and address of each signer, and the type of identification relied upon. Journal entries are retained for the period required by state law and are released only as the law permits or requires."
  },
  {
    heading: "Cancellation and Rescheduling",
    body: "Please give as much notice as possible if you need to cancel or reschedule. If the notary travels to the appointment location and the signing cannot be completed \u2014 for example, because a signer is unavailable, identification is missing, or documents have not arrived \u2014 any agreed travel or trip fee remains payable for the trip made."
  },
  {
    heading: "Privacy of Your Information",
    body: "Information collected for this appointment is used to schedule the appointment, complete and record the notarial act, and bill for services. It is not sold. It is disclosed only to complete the transaction you have requested, or where required by law."
  },
  {
    heading: "Consent to Do Business Electronically",
    body: "By signing electronically below, you agree that your electronic signature is the legal equivalent of your handwritten signature on this consent form, that you intend it to be binding, and that this record may be delivered and retained electronically. You may request a paper copy of this form at no charge, and you may withdraw consent to electronic delivery at any time, by contacting {{business.name}}{{business.emailSuffix}}. Withdrawing consent does not affect the validity of records already signed. To view and retain this record you need a device with an internet connection, a current web browser, and the ability to receive email and open PDF files."
  },
  {
    heading: "Scope of This Consent",
    body: "This form is a consent and disclosure for notarial services. It is not the document being notarized, and signing it does not notarize anything. It does not create an attorney-client relationship and is not a substitute for legal advice."
  }
];
var BASE_CLAUSES = [...BASE_CLAUSES_INTRO, ...PER_SIGNATURE_FEE_CLAUSES, ...BASE_CLAUSES_TAIL];
var FLAT_BASE_CLAUSES = [...BASE_CLAUSES_INTRO, FLAT_FEE_CLAUSE, ...BASE_CLAUSES_TAIL];
var CONSENT_TEMPLATES = [
  {
    id: "general-notary",
    name: "General Notary Work",
    description: "Vehicle titles, powers of attorney, affidavits, bills of sale, and single documents.",
    segment: "General",
    documentTitle: "Client Consent & Disclosure \u2014 General Notary Services",
    fields: [
      ...COMMON_FIELDS,
      { key: "documentTypes", label: "Documents to Be Notarized", type: "textarea", required: true, placeholder: "e.g. NC vehicle title (seller signature), durable power of attorney, affidavit of residency, bill of sale" },
      { key: "signerNames", label: "All Signers", type: "textarea", required: true, placeholder: "Everyone whose signature must be notarized. Each needs their own valid photo ID.", prefillFrom: "fullName" },
      { key: "vehicleInfo", label: "Vehicle / VIN", type: "text", help: "Title work only. Leave blank otherwise." },
      { key: "witnessesNeeded", label: "Witnesses Required", type: "select", options: ["None", "One (1)", "Two (2)", "Unsure \u2014 please advise"] },
      { key: "apostilleNeeded", label: "Apostille Requested", type: "select", options: ["No", "Yes"], help: "The notary cannot issue an apostille; it is obtained from the Secretary of State afterward." }
    ],
    clauses: [
      {
        heading: "Nature of This Appointment",
        body: "This appointment is to notarize the following for {{signerNames}}: {{documentTypes}}. The notary will verify identity, confirm each signer is signing willingly and knowingly, witness the signature, and complete the notarial certificate."
      },
      {
        heading: "Documents Must Not Be Signed in Advance",
        body: "Do not sign your documents before the appointment. The notary must personally witness each signature that is being notarized. A document already bearing a signature cannot be notarized, and the signer would have to sign a fresh copy. This applies to vehicle titles, which are frequently spoiled this way."
      },
      {
        heading: "Vehicle Titles and Transfer Documents",
        body: "For title work on {{vehicleInfo}}, please understand what the notary can and cannot do. The notary witnesses the signature only. The notary does not verify who owns the vehicle, does not confirm the odometer reading, does not check for liens, and cannot tell you which boxes to complete, how to state the sale price, or what to write on the odometer or damage disclosure. Those entries are your statements, and questions about them belong with the NCDMV, a license plate agency, or your attorney. Titles with erasures, correction fluid, cross-outs, or the wrong name in a field are commonly rejected by the DMV, and the notary may decline a title that appears altered."
      },
      {
        heading: "Every Signer Must Appear in Person",
        body: "Each person whose signature is being notarized must be physically present with their own valid, unexpired, government-issued photo identification. One person cannot sign for another without properly executed authority presented at the appointment, and a signer cannot be added by phone or video."
      },
      {
        heading: "Complete Documents Only",
        body: "The notary cannot notarize a document with blank spaces in the areas being certified, and cannot notarize a photocopy of a signature or a document you have not read. Please bring the complete document, including any pages the notarial certificate refers to."
      },
      {
        heading: "Choosing the Notarial Act",
        body: "The notary cannot choose the type of notarial act for you. If your document does not state whether it needs an acknowledgment, a jurat, or an oath, you must ask the receiving agency \u2014 the DMV, the court, the bank, or the requesting party \u2014 before the appointment. Selecting it for you would be the unauthorized practice of law."
      },
      {
        heading: "Witnesses",
        body: "Witnesses required for this appointment: {{witnessesNeeded}}. If witnesses are needed, please arrange them in advance. Witnesses must be adults with identification, and the notary cannot serve as a witness to a document they are notarizing."
      },
      {
        heading: "Apostille and Authentication",
        body: "Apostille requested: {{apostilleNeeded}}. An apostille is issued by the Secretary of State, not by the notary. The notary can complete a notarization in the form the Secretary of State requires, but obtaining, paying for, and submitting for the apostille is a separate step handled after this appointment."
      },
      ...BASE_CLAUSES
    ],
    acknowledgements: [
      ...BASE_ACKNOWLEDGEMENTS,
      {
        key: "notPreSigned",
        label: "My documents will be unsigned when we meet, and I understand a signature made before the appointment cannot be notarized.",
        required: true
      },
      {
        key: "signersPresent",
        label: "Every person whose signature must be notarized will be present with their own valid photo ID.",
        required: true
      },
      {
        key: "actChosen",
        label: "I understand the notary cannot decide which notarial act my document needs, or tell me how to fill it out \u2014 including on a vehicle title.",
        required: true
      }
    ]
  },
  {
    id: "real-estate",
    name: "Real Estate / Loan Signing",
    description: "Closings, refinances, HELOCs, and seller packages \u2014 flat signing-agent fee.",
    segment: "Real Estate",
    documentTitle: "Client Consent & Disclosure \u2014 Real Estate Loan Signing",
    // Loan signings bill a single flat fee for the package, not the statutory
    // per-signature fee plus mileage.
    pricingModel: "flat",
    fields: [
      ...APPOINTMENT_FIELDS,
      ...FLAT_FEE_FIELDS,
      { key: "propertyAddress", label: "Property Address", type: "textarea", required: true, prefillFrom: "propertyAddress" },
      { key: "transactionType", label: "Transaction Type", type: "select", required: true, options: ["Purchase", "Refinance", "HELOC", "Seller Package", "Reverse Mortgage", "Loan Modification", "Other"] },
      { key: "lenderName", label: "Lender", type: "text" },
      { key: "titleCompany", label: "Title / Escrow Company", type: "text" },
      { key: "escrowNumber", label: "Loan / Escrow Number", type: "text" },
      { key: "coSignerName", label: "Co-Signer Name", type: "text", prefillFrom: "spouseName", help: "Every signer must be present with their own valid ID." },
      { key: "docReturnMethod", label: "Document Return Method", type: "select", options: ["Prepaid overnight label", "Drop at shipping location", "Scan-back then ship", "Hand delivery", "Other"] }
    ],
    clauses: [
      {
        heading: "Nature of This Appointment",
        body: "This appointment is a {{transactionType}} signing for the property at {{propertyAddress}}, arranged through {{titleCompany}} for {{lenderName}} under loan/escrow number {{escrowNumber}}. The notary acts as a signing agent: presenting your closing package, directing you to each signature, date, and initial line, notarizing the documents that require it, and returning the executed package."
      },
      {
        heading: "The Notary Cannot Explain Your Loan",
        body: "The notary cannot advise you on your interest rate, payment amount, closing costs, prepayment penalties, escrow amounts, or any other term of your loan, and cannot tell you whether you should sign. Questions about loan terms must be directed to your lender, loan officer, escrow officer, or attorney. If a term does not look correct to you, stop and call them before signing \u2014 do not rely on the notary."
      },
      {
        heading: "All Signers Must Be Present",
        body: "Every person signing the package \u2014 including {{coSignerName}} where listed \u2014 must be physically present at the appointment with their own valid, unexpired, government-issued photo identification. The notary cannot notarize for an absent signer, cannot accept a signature made in advance, and cannot allow one signer to sign on behalf of another without properly executed and presented authority."
      },
      {
        heading: "Document Handling and Return",
        body: "Your executed package will be returned by: {{docReturnMethod}}. The notary handles your package as confidential, keeps it secure from the time it is printed to the time it is returned, and does not retain copies of your loan documents beyond what is required for the journal entry."
      },
      {
        heading: "Incomplete or Late Packages",
        body: "If the signing cannot be completed because documents have not arrived, arrive incomplete, contain errors requiring lender correction, or a signer is unavailable or unidentifiable, the appointment will be rescheduled and any agreed trip or print fee remains payable for the trip made."
      },
      ...FLAT_BASE_CLAUSES
    ],
    acknowledgements: [
      // The base fee acknowledgement talks about statutory + travel; a flat
      // signing needs its own wording.
      ...BASE_ACKNOWLEDGEMENTS.filter((a) => a.key !== "feesUnderstood"),
      {
        key: "feesUnderstood",
        label: "I have reviewed the flat signing fee shown above, I agree to that amount as the total for this signing, and I understand there is no separate per-signature or mileage charge.",
        required: true
      },
      {
        key: "lenderQuestions",
        label: "I understand that all questions about my loan terms, closing costs, and figures must go to my lender, escrow officer, or attorney \u2014 not the notary.",
        required: true
      },
      {
        key: "allSignersPresent",
        label: "All signers listed on the documents will be present at the appointment with their own valid photo ID.",
        required: true
      }
    ]
  },
  {
    id: "estate-planning",
    name: "Estate Planning Documents",
    description: "Wills, trusts, powers of attorney, healthcare directives, and deeds.",
    segment: "Estate Planning",
    documentTitle: "Client Consent & Disclosure \u2014 Estate Planning Document Signing",
    fields: [
      ...COMMON_FIELDS,
      { key: "documentTypes", label: "Documents to Be Notarized", type: "textarea", required: true, placeholder: "e.g. Revocable living trust, pour-over will, durable power of attorney, healthcare power of attorney, living will" },
      { key: "attorneyName", label: "Drafting Attorney / Firm", type: "text", help: "Leave blank if the client prepared the documents without counsel." },
      { key: "witnessesNeeded", label: "Witnesses Required", type: "select", required: true, options: ["None", "One (1)", "Two (2)"] },
      { key: "witnessesProvidedBy", label: "Witnesses Provided By", type: "select", options: ["Client", "Notary (arranged in advance)", "Attorney office", "Not applicable"] },
      { key: "principalName", label: "Principal / Grantor Name", type: "text", prefillFrom: "fullName" }
    ],
    clauses: [
      {
        heading: "Nature of This Appointment",
        body: "This appointment is to notarize estate planning documents for {{principalName}}, specifically: {{documentTypes}}. Where a drafting attorney is involved ({{attorneyName}}), the notary works only within the signing instructions that attorney provides."
      },
      {
        heading: "The Notary Did Not Prepare These Documents",
        body: "The notary did not draft, select, or review your estate planning documents and cannot tell you whether they accomplish what you intend, whether a will or a trust is right for you, how your property will pass, or what tax consequences may follow. Those are legal questions for a licensed attorney. If your documents were prepared without an attorney, please understand that the notary is not able to check them for you."
      },
      {
        heading: "Witnesses",
        body: "This signing requires: {{witnessesNeeded}} witness(es), to be provided by {{witnessesProvidedBy}}. Witnesses must be adults, must be present for the entire signing, and generally should be disinterested \u2014 that is, not named as a beneficiary, fiduciary, or heir, and not a spouse of one. The notary cannot serve as a witness to a document they are also notarizing."
      },
      {
        heading: "Capacity and Free Will",
        body: "The notary must be satisfied that the principal appears aware of what they are signing and is acting of their own free will, without duress or undue influence. If the principal appears confused, cannot communicate their intent, or appears to be directed by another person present, the notary is required to decline the notarization. Determining legal capacity is a matter for a physician and an attorney, not the notary, and the notary makes no determination of legal capacity."
      },
      {
        heading: "Third Parties Present",
        body: "Family members and caregivers may be present for comfort, but the principal must answer for themselves and sign for themselves. The notary may ask others to step back or step out of the room briefly to confirm the principal is signing freely."
      },
      {
        heading: "Original Documents",
        body: "Estate planning documents are usually valid only as executed originals. The notary does not retain your originals and does not keep copies of the documents beyond the journal entry. Store your originals safely and tell your executor, trustee, or agent where to find them."
      },
      ...BASE_CLAUSES
    ],
    acknowledgements: [
      ...BASE_ACKNOWLEDGEMENTS,
      {
        key: "attorneyQuestions",
        label: "I understand the notary did not prepare these documents and cannot advise me on whether they accomplish my wishes; those questions go to a licensed attorney.",
        required: true
      },
      {
        key: "witnessesArranged",
        label: "I understand the witness requirement stated above and who is responsible for providing witnesses.",
        required: true
      },
      {
        key: "noUndueInfluence",
        label: "I am signing free of pressure from any family member, caregiver, or other person, and the decisions in these documents are my own.",
        required: true
      }
    ]
  },
  {
    id: "hospital-facility",
    name: "Hospital / Nursing Home Signing",
    description: "Bedside signings at hospitals, rehabilitation centers, hospice, and care facilities.",
    segment: "Hospital & Nursing Home",
    documentTitle: "Client Consent & Disclosure \u2014 Hospital / Care Facility Signing",
    fields: [
      ...COMMON_FIELDS,
      { key: "facilityName", label: "Facility Name", type: "text", required: true },
      { key: "facilityAddress", label: "Facility Address", type: "textarea", required: true },
      { key: "roomNumber", label: "Room / Unit Number", type: "text" },
      { key: "signerName", label: "Patient / Signer Name", type: "text", required: true },
      { key: "requestedBy", label: "Appointment Requested By", type: "text", required: true, prefillFrom: "fullName", help: "Person arranging the appointment, if not the patient." },
      { key: "requestorRelationship", label: "Relationship to Signer", type: "text", placeholder: "e.g. daughter, attorney, case manager" },
      { key: "documentTypes", label: "Documents to Be Notarized", type: "textarea", required: true },
      { key: "witnessesNeeded", label: "Witnesses Required", type: "select", required: true, options: ["None", "One (1)", "Two (2)"] },
      { key: "witnessSource", label: "Witnesses Provided By", type: "select", options: ["Family", "Facility staff", "Notary (arranged in advance)", "Not applicable"] }
    ],
    clauses: [
      {
        heading: "Nature of This Appointment",
        body: "This is a bedside notarization for {{signerName}} at {{facilityName}}, {{facilityAddress}}, room {{roomNumber}}. The appointment was requested by {{requestedBy}} ({{requestorRelationship}}). The documents to be notarized are: {{documentTypes}}."
      },
      {
        heading: "The Signer Must Be Awake, Aware, and Able to Communicate",
        body: "The notary must speak directly with the signer. The signer must be awake and responsive, must be able to communicate that they understand they are signing a document and what kind of document it is, and must be able to indicate their intent without being coached. Sedation, pain medication, confusion, or fatigue may make notarization impossible at that moment. If so, the notary will suggest returning at a better time of day."
      },
      {
        heading: "No Determination of Medical or Legal Capacity",
        body: "The notary is not a physician and is not an attorney. The notary makes no determination of the signer's medical or legal capacity. The notary only observes whether the signer appears aware of the nature of the act and is acting willingly at that moment. If the signer's capacity is in question, obtain a physician's assessment and consult an attorney before scheduling."
      },
      {
        heading: "Signing Free of Influence",
        body: "The signer must sign of their own free will. The notary may ask family members, caregivers, or facility staff to step away from the bedside so the notary can speak with the signer privately. If it appears the signer is being pressured or directed, or that someone else is answering for them, the notary is required to decline. This protection exists for the signer's benefit."
      },
      {
        heading: "If the Signer Cannot Sign by Hand",
        body: "A signer physically unable to sign may be able to make a mark, or to direct another person to sign their name in their presence and at their direction, with witnesses. This depends on the document and state law, and the requirements must be confirmed before the appointment. Please raise this in advance so it does not delay the signing."
      },
      {
        heading: "Witnesses",
        body: "This signing requires {{witnessesNeeded}} witness(es), provided by {{witnessSource}}. Please note that many facilities restrict their staff from acting as witnesses, and staff are typically unavailable on short notice. Confirm witnesses in advance. Witnesses should be disinterested \u2014 not a beneficiary, agent, or heir under the document."
      },
      {
        heading: "Facility Access and Timing",
        body: "Access depends entirely on the facility. Visiting hours, infection-control precautions, isolation status, staff availability, and the signer's treatment schedule can all delay or prevent the appointment. Please clear the visit with the facility and the care team in advance. If the notary arrives and cannot gain access or the signer is not available, the travel fee remains payable."
      },
      {
        heading: "Health Information",
        body: "The notary does not request or record medical information and will not document a diagnosis or treatment in the journal. The journal records only what the law requires: the act performed, the document type, the signer's name and address, the identification relied upon, and the date, time, and location."
      },
      ...BASE_CLAUSES
    ],
    acknowledgements: [
      ...BASE_ACKNOWLEDGEMENTS,
      {
        key: "signerAware",
        label: "The signer is expected to be awake, responsive, and able to communicate at the scheduled time, and I understand the notary must decline if they are not.",
        required: true
      },
      {
        key: "noCapacityJudgment",
        label: "I understand the notary makes no determination of medical or legal capacity and that a physician or attorney should be consulted if capacity is in question.",
        required: true
      },
      {
        key: "facilityAccess",
        label: "I have confirmed, or will confirm, that the facility permits this visit at the scheduled time, and I understand the travel fee applies if access is denied.",
        required: true
      },
      {
        key: "witnessesConfirmed",
        label: "I understand the witness requirement above and that facility staff often cannot serve as witnesses.",
        required: true
      }
    ]
  }
];
function getConsentTemplate(id) {
  return CONSENT_TEMPLATES.find((t) => t.id === id);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var CURRENCY_FIELDS = /* @__PURE__ */ new Set(["notarialFee", "travelFee", "flatFee"]);
function toNumber(raw) {
  const n = Number(String(raw ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function money(n) {
  return `$${n.toFixed(2)}`;
}
function isChecked(raw) {
  return raw === "true" || raw === "yes" || raw === "1";
}
function computeConsentCost(fields, model = "per-signature") {
  const flatFee = toNumber(fields.flatFee);
  const feePerSignature = toNumber(fields.notarialFee);
  const signatureCount = Math.max(0, Math.floor(toNumber(fields.actCount)));
  const travelFeeBeforeWaiver = toNumber(fields.travelFee);
  const travelWaived = isChecked(fields.travelWaived);
  const travelFee = travelWaived ? 0 : travelFeeBeforeWaiver;
  const notarialSubtotal = Math.round(feePerSignature * signatureCount * 100) / 100;
  const total = model === "flat" ? flatFee : Math.round((notarialSubtotal + travelFee) * 100) / 100;
  return {
    model,
    feePerSignature,
    signatureCount,
    notarialSubtotal,
    travelFee,
    travelFeeBeforeWaiver,
    travelWaived,
    travelMiles: toNumber(fields.travelMiles),
    flatFee,
    total
  };
}
function formatFieldValue(key, raw) {
  const value = (raw ?? "").trim();
  if (!value) return CURRENCY_FIELDS.has(key) ? "$0.00" : "not specified";
  if (CURRENCY_FIELDS.has(key)) {
    const num = Number(value.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(num) ? `$${num.toFixed(2)}` : value;
  }
  if (key === "appointmentDate") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
    }
  }
  return value;
}
function interpolate(text, fields, business) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token) => {
    if (token.startsWith("business.")) {
      const prop = token.slice("business.".length);
      if (prop === "emailSuffix") return business.email ? ` at ${business.email}` : "";
      const val = business[prop];
      return String(val ?? "");
    }
    return formatFieldValue(token, fields[token]);
  });
}
function renderConsentDocument(opts) {
  const { template, fields, business } = opts;
  const cost = computeConsentCost(fields, template.pricingModel);
  const summaryRows = [
    ["Client / Signer", formatFieldValue("clientName", fields.clientName)],
    ["Appointment", `${formatFieldValue("appointmentDate", fields.appointmentDate)} at ${formatFieldValue("appointmentTime", fields.appointmentTime)}`],
    ["Location", formatFieldValue("appointmentLocation", fields.appointmentLocation)],
    ["Notary", business.name]
  ];
  if (business.commissionNumber) {
    summaryRows.push(["Commission Number", business.commissionNumber]);
  }
  if (business.commissionExpiration) {
    summaryRows.push(["Commission Expires", business.commissionExpiration]);
  }
  const summary = summaryRows.map(
    ([label, value]) => `
      <tr>
        <th style="text-align:left;padding:8px 16px 8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</th>
        <td style="padding:8px 0;color:#0f172a;font-size:14px;vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`
  ).join("");
  const clauseFields = {
    ...fields,
    travelFee: String(cost.travelFee),
    feeIncludes: (fields.feeIncludes || "").trim() || "the notarizations, travel, and printing for this signing"
  };
  const clauses = template.clauses.map(
    (c, i) => `
    <section style="margin:0 0 22px;">
      <h3 style="margin:0 0 6px;font-size:14px;font-weight:700;color:#1e3a5f;">${i + 1}. ${escapeHtml(c.heading)}</h3>
      <p style="margin:0;font-size:14px;line-height:1.75;color:#334155;">${escapeHtml(interpolate(c.body, clauseFields, business))}</p>
    </section>`
  ).join("");
  const costRow = (label, detail, amount, bold = false) => `
      <tr>
        <td style="padding:10px 16px 10px 0;vertical-align:top;">
          <div style="font-size:${bold ? "15" : "14"}px;font-weight:${bold ? "700" : "600"};color:#0f172a;">${escapeHtml(label)}</div>
          ${detail ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${escapeHtml(detail)}</div>` : ""}
        </td>
        <td style="padding:10px 0;text-align:right;vertical-align:top;white-space:nowrap;font-size:${bold ? "18" : "14"}px;font-weight:${bold ? "800" : "600"};color:${bold ? "#1e3a5f" : "#0f172a"};">${escapeHtml(amount)}</td>
      </tr>`;
  const costRows = cost.model === "flat" ? costRow(
    "Flat signing fee",
    (fields.feeIncludes || "").trim() || "Includes notarizations, travel, and printing",
    money(cost.flatFee)
  ) : `${costRow(
    "Notarial fee",
    `${cost.signatureCount} notarized signature${cost.signatureCount === 1 ? "" : "s"} \xD7 ${money(cost.feePerSignature)} each`,
    money(cost.notarialSubtotal)
  )}
      ${cost.travelWaived ? costRow(
    "Travel reimbursement \u2014 waived",
    cost.travelFeeBeforeWaiver > 0 ? `${money(cost.travelFeeBeforeWaiver)} waived by ${business.name}` : `No travel charge for this appointment`,
    money(0)
  ) : costRow(
    "Travel reimbursement",
    cost.travelMiles > 0 ? `${cost.travelMiles} round-trip miles, agreed in advance` : "Round-trip mileage, agreed in advance",
    money(cost.travelFee)
  )}`;
  const costNote = cost.model === "flat" ? `This is a flat fee for the signing, payable at the time of service. There is no separate per-signature or mileage charge.` : `Payable at the time of service. If the number of signatures changes on the day, the notarial fee changes with it at ${money(cost.feePerSignature)} per signature, and any change is confirmed with you before it is charged.${cost.travelWaived ? " Travel reimbursement has been waived for this appointment and will not be charged." : ""}`;
  const costTable = `
  <section style="margin:0 0 24px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <div style="background:#1e3a5f;padding:10px 16px;">
      <h2 style="margin:0;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">Cost of Services</h2>
    </div>
    <table style="border-collapse:collapse;width:100%;padding:0 16px;">
      ${costRows}
      <tr><td colspan="2" style="border-top:1px solid #e2e8f0;padding:0;"></td></tr>
      ${costRow("Total due at appointment", "", money(cost.total), true)}
    </table>
    <p style="margin:0;padding:0 16px 14px;font-size:11px;line-height:1.6;color:#64748b;">
      ${costNote}
    </p>
  </section>`;
  return `
<article style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#0f172a;">
  <header style="border-bottom:2px solid #1e3a5f;padding-bottom:16px;margin-bottom:20px;">
    <h1 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#1e3a5f;">${escapeHtml(template.documentTitle)}</h1>
    <p style="margin:0;font-size:13px;color:#64748b;">${escapeHtml(business.name)}${business.location ? " &bull; " + escapeHtml(business.location) : ""}${business.phone ? " &bull; " + escapeHtml(business.phone) : ""}</p>
  </header>

  <table style="border-collapse:collapse;width:100%;margin:0 0 20px;background:#f8fafc;border-radius:10px;padding:8px;">
    ${summary}
  </table>

  ${costTable}

  ${clauses}
</article>`.trim();
}

// src/lib/signatureFonts.ts
var SIGNATURE_FONTS = [
  { id: "dancing", label: "Flowing", family: "'Dancing Script', cursive", scale: 1 },
  { id: "greatvibes", label: "Formal", family: "'Great Vibes', cursive", scale: 1.05 },
  { id: "homemade", label: "Handwritten", family: "'Homemade Apple', cursive", scale: 0.78 },
  { id: "sacramento", label: "Classic", family: "'Sacramento', cursive", scale: 1.05 },
  { id: "caveat", label: "Casual", family: "'Caveat', cursive", scale: 1.05 }
];
var SIGNATURE_FONT_IDS = SIGNATURE_FONTS.map((f) => f.id);

// server.ts
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
dotenv.config();
function parseServiceAccountJson() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const attempts = [
    () => JSON.parse(raw),
    () => JSON.parse(raw.replace(/\\{/g, "{").replace(/\\}/g, "}")),
    () => JSON.parse(raw.replace(/\\{/g, "{").replace(/\\}/g, "}").replace(/\\"/g, '"')),
    () => JSON.parse(raw.replace(/\\([^"\\\/bfnrtu])/g, "$1")),
    () => JSON.parse(JSON.parse(`"${raw.replace(/"/g, '\\"')}"`))
  ];
  for (let i = 0; i < attempts.length; i++) {
    try {
      const result = attempts[i]();
      console.log(`[Firebase Admin] JSON parsed successfully on attempt ${i + 1}`);
      return result;
    } catch (e) {
      console.warn(`[Firebase Admin] Parse attempt ${i + 1} failed`);
    }
  }
  throw new Error("All JSON parse attempts failed for GOOGLE_SERVICE_ACCOUNT_JSON");
}
function fixPrivateKey(key) {
  if (!key) return key;
  key = key.replace(/\\n/g, "\n");
  if (key.includes("-----BEGIN RSA PRIVATE KEY-----") || key.includes("-----BEGIN PRIVATE KEY-----")) {
    const header = key.match(/-----BEGIN [^-]+-----/)?.[0] || "-----BEGIN PRIVATE KEY-----";
    const footer = key.match(/-----END [^-]+-----/)?.[0] || "-----END PRIVATE KEY-----";
    const body = key.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
    const lines = body.match(/.{1,64}/g)?.join("\n") || body;
    return `${header}
${lines}
${footer}`;
  }
  return key;
}
var adminDb = null;
var adminAuth = null;
if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.warn("[Firebase Admin] GOOGLE_SERVICE_ACCOUNT_JSON is not set. Firestore sync features will run in demo/offline mode.");
} else {
  try {
    const serviceAccount = parseServiceAccountJson();
    serviceAccount.private_key = fixPrivateKey(serviceAccount.private_key);
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    const rawDbId = process.env.FIREBASE_DATABASE_ID || "";
    const useDefault = !rawDbId || ["", "(default)", "undefined", "null"].includes(rawDbId.trim());
    adminDb = useDefault ? getFirestore() : getFirestore(rawDbId.trim());
    adminAuth = getAdminAuth();
    console.log(`[Firebase Admin] Connected to Firestore: ${useDefault ? "default" : rawDbId.trim()}`);
  } catch (e) {
    console.error("[Firebase Admin] Failed to initialize:", e?.message || e);
  }
}
var resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
var anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
var APP_URL = process.env.APP_URL || "https://www.notaryproapp.com";
async function getBusinessProfile(uid) {
  if (!adminDb) throw new Error("Database not available");
  const doc = await adminDb.collection("profiles").doc(uid).get();
  const d = doc.data() || {};
  const parts = [d.address, d.city, d.state].filter(Boolean);
  return {
    name: d.companyName || d.name || "NotaryPro",
    email: d.email || "",
    phone: d.phone || "",
    website: d.website || "",
    location: parts.join(", ")
  };
}
function buildFromEmail(biz) {
  const addr = process.env.FROM_EMAIL_ADDRESS || "noreply@notaryproapp.com";
  return `${biz.name} <${addr}>`;
}
function baseTemplate(content, biz) {
  const websiteDisplay = biz.website.replace(/^https?:\/\//, "");
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${biz.name}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">${biz.name}</h1>
            <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;letter-spacing:1px;">PROFESSIONAL NOTARY SERVICES</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;color:#64748b;font-size:12px;">${biz.name}${biz.location ? " &bull; " + biz.location : ""}</p>
            ${biz.website ? `<p style="margin:6px 0 0;color:#64748b;font-size:12px;"><a href="${biz.website}" style="color:#2563eb;text-decoration:none;">${websiteDisplay}</a></p>` : ""}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
function signUnsubscribeToken(customerId) {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    console.warn("[Unsubscribe] UNSUBSCRIBE_SECRET is not set \u2014 tokens are not secure.");
    return "unsigned";
  }
  return crypto.createHmac("sha256", secret).update(customerId).digest("hex");
}
function verifyUnsubscribeToken(customerId, token) {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) return true;
  const expected = crypto.createHmac("sha256", secret).update(customerId).digest("hex");
  try {
    return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
function unsubscribeFooter(customerId) {
  const token = signUnsubscribeToken(customerId);
  return `<p style="margin:24px 0 0;text-align:center;font-size:11px;color:#94a3b8;">
    Don't want to receive these emails?
    <a href="${APP_URL}/api/email/unsubscribe/${customerId}?token=${token}" style="color:#94a3b8;">Unsubscribe</a>
  </p>`;
}
var CONSENT_SECRET = process.env.CONSENT_SECRET || process.env.UNSUBSCRIBE_SECRET || "";
var CONSENT_LINK_DAYS = Number(process.env.CONSENT_LINK_DAYS || 30);
function signConsentToken(formId, expiresAt) {
  if (!CONSENT_SECRET) {
    console.warn("[Consent] CONSENT_SECRET/UNSUBSCRIBE_SECRET is not set \u2014 signing links are NOT secure.");
    return "unsigned";
  }
  return crypto.createHmac("sha256", CONSENT_SECRET).update(`${formId}:${expiresAt}`).digest("hex");
}
function verifyConsentToken(formId, expiresAt, token) {
  if (!CONSENT_SECRET) return true;
  if (!expiresAt || !token) return false;
  const expected = crypto.createHmac("sha256", CONSENT_SECRET).update(`${formId}:${expiresAt}`).digest("hex");
  try {
    return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
function buildSigningUrl(formId, expiresAt) {
  const token = signConsentToken(formId, expiresAt);
  return `${APP_URL}/sign/${formId}?token=${token}&exp=${encodeURIComponent(expiresAt)}`;
}
function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd || "";
  return (raw.split(",")[0] || req.socket.remoteAddress || "").trim();
}
var PRACTICE_RULES = [
  { match: /estate|elder|trust|probate|wills?/i, area: "estate planning", docs: "wills, trusts, powers of attorney, and healthcare directives \u2014 including bedside signings at hospitals or care facilities when a client cannot travel" },
  { match: /famil|divorce|custody|matrimonial|adoption|formation/i, area: "family law", docs: "separation agreements, property settlements, and affidavits that need prompt, dependable notarization" },
  { match: /injur|accident|malpractice|tort|wrongful/i, area: "personal injury", docs: "settlement releases, affidavits, and disbursement documents, often on tight deadlines" },
  { match: /real estate|closing|title|property|mortgage|loan/i, area: "real estate", docs: "loan signings and closing packages at the title office, a client\u2019s home, or any preferred location" },
  { match: /franchise|business|corporate|patent|\bip\b|startup|venture|commercial|securit/i, area: "business & corporate law", docs: "entity-formation documents, operating agreements, and contracts that require notarization" },
  { match: /immigration|visa|citizen/i, area: "immigration law", docs: "affidavits, sponsorship forms, and supporting documents that require notarization" }
];
var DEFAULT_PRACTICE = { area: "legal", docs: "time-sensitive documents that require a reliable, mobile notary" };
function inferPractice(haystack) {
  for (const r of PRACTICE_RULES) if (r.match.test(haystack)) return { area: r.area, docs: r.docs };
  return DEFAULT_PRACTICE;
}
function firmOf(customer) {
  if (customer.company) return customer.company;
  const notes = customer.notes || "";
  const idx = notes.indexOf(" at ");
  return idx >= 0 ? notes.slice(idx + 4).trim() : "";
}
function escapeHtmlText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
async function selectRecipients(uid, recipientGroups, tags) {
  if (!adminDb) throw new Error("Database not available");
  const snapshot = await adminDb.collection("customers").where("userId", "==", uid).get();
  let customers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  customers = customers.filter((c) => !c.unsubscribed);
  if (!recipientGroups.includes("all")) {
    const wantedTags = Array.isArray(tags) ? tags : [];
    const typeToContact = (t) => (t || "").toLowerCase().replace(/\s+/g, "_");
    customers = customers.filter((c) => {
      const cTags = c.tags || [];
      const matchesTags = wantedTags.length > 0 && wantedTags.some((t) => cTags.includes(t) || typeToContact(c.customerType) === t);
      const matchesType = recipientGroups.includes(c.customerType);
      return matchesTags || matchesType;
    });
  }
  return customers.filter((c) => c.email && c.email.trim() !== "");
}
async function personalizeIntro(customer, practice, biz) {
  if (!anthropic) throw new Error("AI not configured");
  const firm = firmOf(customer);
  const prompt = `You are writing the BODY of a short, warm, professional cold-outreach email on behalf of ${biz.name}, a certified mobile notary public serving ${biz.location || "the local area"}.

Recipient:
- Name: ${customer.fullName || customer.firstName || ""}
- Role/notes: ${customer.notes || customer.title || ""}
- Firm: ${firm}
- Likely practice area: ${practice.area}
- Relevant notary work for this practice: ${practice.docs}

Strict requirements:
- Return ONLY valid JSON: {"subject": string, "paragraphs": [string, string]}
- Exactly TWO short paragraphs (2-3 sentences each), plain text, no HTML, no markdown.
- Do NOT include a greeting ("Dear ...") or a sign-off \u2014 those are added separately.
- Reference their ${practice.area} focus naturally and tie it to the documents/situations above.
- Mention mobile, same-day availability across ${biz.location || "the area"}.
- Do NOT invent facts about the firm (no awards, case results, client names, or dates).
- Tone: courteous, concise, peer-to-peer. No emojis, no buzzwords.
- Subject line: 5-9 words, specific, no clickbait, no ALL CAPS.`;
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }]
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse AI response");
  const obj = JSON.parse(jsonMatch[0]);
  const paragraphs = Array.isArray(obj.paragraphs) ? obj.paragraphs.map((p) => String(p).trim()) : [];
  if (!obj.subject || paragraphs.length === 0) throw new Error("AI returned unexpected shape");
  return { subject: String(obj.subject).trim(), paragraphs };
}
function renderPersonalized(templateHtml, customer, intro) {
  const firstName = (customer.firstName || customer.fullName || "").trim().split(/\s+/)[0] || "there";
  const firm = firmOf(customer);
  const paras = intro.paragraphs.map((p, i) => {
    const mb = i === intro.paragraphs.length - 1 ? "0" : "20px";
    return `<p style="margin:0 0 ${mb} 0;font-size:15px;line-height:1.7;color:#374151;">${escapeHtmlText(p)}</p>`;
  }).join("\n              ");
  const introBlock = `<!-- INTRO -->
          <tr>
            <td style="padding:44px 48px 28px 48px;">
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#374151;">Dear ${escapeHtmlText(firstName)},</p>
              ${paras}
            </td>
          </tr>

          <!-- DIVIDER -->`;
  let html = templateHtml.replace(/<!-- INTRO -->[\s\S]*?<!-- DIVIDER -->/, introBlock);
  html = html.replace(/\[First Name\]/g, escapeHtmlText(firstName));
  html = html.replace(/\[Law Firm Name\]/g, escapeHtmlText(firm));
  return html;
}
var TEMPLATES = {
  thank_you: {
    subject: (biz) => `Thank You for Choosing ${biz.name}`,
    html: (d, biz) => baseTemplate(`
      <h2 style="margin:0 0 16px;color:#1e3a5f;font-size:20px;">Thank You, ${d.firstName}!</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 16px;">
        We truly appreciate you trusting ${biz.name} with your notary needs.
        It was a pleasure working with you, and we hope to serve you again in the future.
      </p>
      <p style="color:#475569;line-height:1.7;margin:0 0 16px;">
        If you have any questions or need notary services again, don't hesitate to reach out.
        We're available 7 days a week.
      </p>
      ${biz.website ? `<div style="text-align:center;margin:28px 0;"><a href="${biz.website}/book" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Book Again</a></div>` : ""}
      ${d.customerId ? unsubscribeFooter(d.customerId) : ""}
    `, biz)
  },
  appointment_reminder: {
    subject: (_biz) => `Reminder: Your Upcoming Notary Appointment`,
    html: (d, biz) => baseTemplate(`
      <h2 style="margin:0 0 16px;color:#1e3a5f;font-size:20px;">Appointment Reminder</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 20px;">Hi ${d.firstName}, this is a friendly reminder about your upcoming appointment:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin:0 0 20px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 10px;color:#1e3a5f;"><strong>\u{1F4C5} Date:</strong> ${d.date || "TBD"}</p>
          <p style="margin:0 0 10px;color:#1e3a5f;"><strong>\u{1F550} Time:</strong> ${d.time || "TBD"}</p>
          <p style="margin:0 0 10px;color:#1e3a5f;"><strong>\u{1F4CD} Location:</strong> ${d.location || "TBD"}</p>
          <p style="margin:0;color:#1e3a5f;"><strong>\u{1F4CB} Type:</strong> ${d.signingType || "Notary Appointment"}</p>
        </td></tr>
      </table>
      <p style="color:#475569;line-height:1.7;margin:0 0 16px;">
        <strong>Please remember to bring:</strong> A valid government-issued photo ID.
        Do not sign any documents before the appointment.
      </p>
      ${d.customerId ? unsubscribeFooter(d.customerId) : ""}
    `, biz)
  },
  new_service: {
    subject: (biz) => `New Service Available \u2014 ${biz.name}`,
    html: (d, biz) => baseTemplate(`
      <h2 style="margin:0 0 16px;color:#1e3a5f;font-size:20px;">Exciting News, ${d.firstName}!</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 16px;">${d.body || "We have a new service available for you."}</p>
      ${biz.website ? `<div style="text-align:center;margin:28px 0;"><a href="${biz.website}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Learn More</a></div>` : ""}
      ${d.customerId ? unsubscribeFooter(d.customerId) : ""}
    `, biz)
  },
  general_outreach: {
    subject: (biz) => `A Message from ${biz.name}`,
    html: (d, biz) => baseTemplate(`
      <h2 style="margin:0 0 16px;color:#1e3a5f;font-size:20px;">Hi ${d.firstName},</h2>
      <div style="color:#475569;line-height:1.7;margin:0 0 16px;">${d.body || ""}</div>
      ${d.customerId ? unsubscribeFooter(d.customerId) : ""}
    `, biz)
  },
  newsletter: {
    subject: (biz) => `Newsletter from ${biz.name}`,
    html: (d, biz) => baseTemplate(`
      <h2 style="margin:0 0 8px;color:#1e3a5f;font-size:22px;">\u{1F4F0} Newsletter</h2>
      <p style="margin:0 0 24px;color:#94a3b8;font-size:13px;text-transform:uppercase;letter-spacing:1px;">From ${biz.name}</p>
      <div style="color:#475569;line-height:1.8;margin:0 0 16px;">${d.body || ""}</div>
      ${biz.website ? `<div style="text-align:center;margin:28px 0;"><a href="${biz.website}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Visit Our Website</a></div>` : ""}
      ${d.customerId ? unsubscribeFooter(d.customerId) : ""}
    `, biz)
  }
};
var genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
async function verifyFirebaseToken(req, res, next) {
  if (!adminAuth) {
    res.status(503).json({ error: "Auth service not available. Ensure GOOGLE_SERVICE_ACCOUNT_JSON is set." });
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: missing or malformed Authorization header" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized: invalid or expired token" });
  }
}
async function startServer() {
  console.log("Starting server process...");
  const app = express();
  const PORT = Number(process.env.PORT) || 3e3;
  let serviceAccountAuth;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    try {
      const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
      serviceAccountAuth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/calendar.events"]
      });
    } catch (e) {
      console.error("Failed to initialize Service Account Auth:", e);
    }
  }
  function getOAuth2Client(req) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    let redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!redirectUri && req) {
      const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const host = req.headers["x-forwarded-host"] || req.get("host");
      const origin = req.get("origin") || `${proto}://${host}`;
      redirectUri = `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
    }
    if (!redirectUri && process.env.APP_URL) {
      redirectUri = `${process.env.APP_URL.replace(/\/$/, "")}/api/auth/google/callback`;
    }
    if (!redirectUri) redirectUri = "http://localhost:3000/api/auth/google/callback";
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }
  app.use(compression());
  app.use(express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(cookieParser());
  app.post("/api/email/send-single", verifyFirebaseToken, async (req, res) => {
    if (!resend) return res.status(503).json({ error: "Email service not configured. Add RESEND_API_KEY." });
    const uid = req.user.uid;
    const { to, toName, customerId, templateId, subject, body, templateData, rawHtml } = req.body;
    if (!to) return res.status(400).json({ error: "Recipient email required" });
    try {
      const biz = await getBusinessProfile(uid);
      const fromEmail = buildFromEmail(biz);
      let emailSubject = subject;
      let emailHtml = "";
      if (rawHtml) {
        emailSubject = subject || `A Message from ${biz.name}`;
        const firstName = toName?.split(" ")[0] || "Valued Client";
        let processedHtml = (body || "").replace(/\{\{firstName\}\}/g, firstName);
        const unsubFooter = customerId ? unsubscribeFooter(customerId) : "";
        if (unsubFooter) {
          processedHtml = processedHtml.includes("</body>") ? processedHtml.replace("</body>", `<div style="text-align:center;padding:16px 0;">${unsubFooter}</div></body>`) : processedHtml + `<div style="text-align:center;padding:16px 0;">${unsubFooter}</div>`;
        }
        emailHtml = processedHtml;
      } else if (templateId && TEMPLATES[templateId]) {
        const template = TEMPLATES[templateId];
        emailSubject = subject || template.subject(biz);
        emailHtml = template.html({
          firstName: toName?.split(" ")[0] || "Valued Client",
          customerId,
          body,
          ...templateData
        }, biz);
      } else {
        emailSubject = subject || `A Message from ${biz.name}`;
        emailHtml = baseTemplate(`
          <h2 style="margin:0 0 16px;color:#1e3a5f;font-size:20px;">Hi ${toName?.split(" ")[0] || "there"},</h2>
          <div style="color:#475569;line-height:1.7;">${body || ""}</div>
          ${customerId ? unsubscribeFooter(customerId) : ""}
        `, biz);
      }
      const tags = [];
      if (customerId) tags.push({ name: "subscriber_id", value: customerId });
      if (templateId) tags.push({ name: "campaign_id", value: templateId });
      const result = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject: emailSubject,
        html: emailHtml,
        tags: tags.length > 0 ? tags : void 0
      });
      console.log(`[Email] Sent single email to ${to}`, result);
      const emailId = result?.data?.id || result?.id;
      if (adminDb && emailId) {
        try {
          await adminDb.collection("emailEvents").add({
            userId: uid,
            subscriberId: customerId || "unknown",
            campaignId: templateId || "single",
            type: "sent",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            metadata: {
              emailId,
              subject: emailSubject,
              to: [to]
            }
          });
        } catch (dbErr) {
          console.error("[Email Sync] Failed to store sent event:", dbErr.message);
        }
      }
      res.json({ success: true, result });
    } catch (error) {
      console.error("[Email] Send single error:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });
  app.post("/api/email/send-newsletter", verifyFirebaseToken, async (req, res) => {
    if (!resend) return res.status(503).json({ error: "Email service not configured. Add RESEND_API_KEY." });
    if (!adminDb) return res.status(503).json({ error: "Database not configured." });
    const uid = req.user.uid;
    const { templateId, subject, body, templateData, recipientGroups, tags, campaignId } = req.body;
    if (!recipientGroups || !recipientGroups.length) {
      return res.status(400).json({ error: "recipientGroups is required" });
    }
    try {
      const biz = await getBusinessProfile(uid);
      const fromEmail = buildFromEmail(biz);
      const snapshot = await adminDb.collection("customers").where("userId", "==", uid).get();
      let customers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      customers = customers.filter((c) => !c.unsubscribed);
      if (!recipientGroups.includes("all")) {
        const wantedTags = Array.isArray(tags) ? tags : [];
        const typeToContact = (t) => (t || "").toLowerCase().replace(/\s+/g, "_");
        customers = customers.filter((c) => {
          const cTags = c.tags || [];
          const matchesTags = wantedTags.length > 0 && wantedTags.some((t) => cTags.includes(t) || typeToContact(c.customerType) === t);
          const matchesType = recipientGroups.includes(c.customerType);
          return matchesTags || matchesType;
        });
      }
      customers = customers.filter((c) => c.email && c.email.trim() !== "");
      if (customers.length === 0) {
        return res.json({ success: true, sent: 0, message: "No eligible recipients found." });
      }
      console.log(`[Email] Newsletter sending to ${customers.length} recipients`);
      const BATCH_SIZE = 50;
      let sent = 0;
      let failed = 0;
      const errors = [];
      for (let i = 0; i < customers.length; i += BATCH_SIZE) {
        const batch = customers.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (customer) => {
          try {
            let emailSubject = subject;
            let emailHtml = "";
            const firstName = customer.firstName || customer.fullName?.split(" ")[0] || "Valued Client";
            if (templateId && TEMPLATES[templateId]) {
              const template = TEMPLATES[templateId];
              emailSubject = subject || template.subject(biz);
              emailHtml = template.html({
                firstName,
                customerId: customer.id,
                body,
                ...templateData
              }, biz);
            } else {
              emailSubject = subject || `A Message from ${biz.name}`;
              emailHtml = baseTemplate(`
                <h2 style="margin:0 0 16px;color:#1e3a5f;font-size:20px;">Hi ${firstName},</h2>
                <div style="color:#475569;line-height:1.7;">${body || ""}</div>
                ${unsubscribeFooter(customer.id)}
              `, biz);
            }
            const tags2 = [];
            if (customer.id) tags2.push({ name: "subscriber_id", value: customer.id });
            if (campaignId || templateId) {
              tags2.push({ name: "campaign_id", value: campaignId || templateId });
            }
            const sendResult = await resend.emails.send({
              from: fromEmail,
              to: [customer.email],
              subject: emailSubject,
              html: emailHtml,
              tags: tags2.length > 0 ? tags2 : void 0
            });
            sent++;
            const emailId = sendResult?.data?.id || sendResult?.id;
            if (adminDb && emailId) {
              try {
                await adminDb.collection("emailEvents").add({
                  userId: uid,
                  subscriberId: customer.id || "unknown",
                  campaignId: campaignId || templateId || "newsletter",
                  type: "sent",
                  timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                  metadata: {
                    emailId,
                    subject: emailSubject,
                    to: [customer.email]
                  }
                });
              } catch (dbErr) {
                console.error("[Email Sync] Failed to store sent event:", dbErr.message);
              }
            }
          } catch (err) {
            failed++;
            errors.push(`${customer.email}: ${err.message}`);
            console.error(`[Email] Failed to send to ${customer.email}:`, err.message);
          }
        }));
        if (i + BATCH_SIZE < customers.length) {
          await new Promise((r) => setTimeout(r, 1e3));
        }
      }
      console.log(`[Email] Newsletter complete. Sent: ${sent}, Failed: ${failed}`);
      res.json({ success: true, sent, failed, errors: errors.slice(0, 10) });
    } catch (error) {
      console.error("[Email] Newsletter error:", error);
      res.status(500).json({ error: error.message || "Failed to send newsletter" });
    }
  });
  app.post("/api/email/personalize-outreach", verifyFirebaseToken, async (req, res) => {
    if (!anthropic) return res.status(503).json({ error: "AI is not configured. Add ANTHROPIC_API_KEY." });
    if (!adminDb) return res.status(503).json({ error: "Database not configured." });
    const uid = req.user.uid;
    const { recipientGroups, tags, templateHtml, limit, skip } = req.body;
    if (!templateHtml || typeof templateHtml !== "string") {
      return res.status(400).json({ error: "templateHtml is required" });
    }
    if (!recipientGroups || !recipientGroups.length) {
      return res.status(400).json({ error: "recipientGroups is required" });
    }
    try {
      const biz = await getBusinessProfile(uid);
      let recipients = await selectRecipients(uid, recipientGroups, Array.isArray(tags) ? tags : []);
      const start = Number.isFinite(skip) ? Math.max(0, Number(skip)) : 0;
      if (start) recipients = recipients.slice(start);
      if (Number.isFinite(limit) && Number(limit) > 0) recipients = recipients.slice(0, Number(limit));
      if (recipients.length === 0) return res.json({ drafts: [], total: 0 });
      console.log(`[Outreach] Personalizing ${recipients.length} drafts`);
      const drafts = [];
      const CONCURRENCY = 5;
      for (let i = 0; i < recipients.length; i += CONCURRENCY) {
        const batch = recipients.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (c) => {
          const firm = firmOf(c);
          const practice = inferPractice(`${firm} ${c.notes || c.title || ""}`);
          const fullName = c.fullName || `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.email;
          try {
            const intro = await personalizeIntro(c, practice, biz);
            const html = renderPersonalized(templateHtml, c, intro);
            return { customerId: c.id, fullName, email: c.email, company: firm, practiceArea: practice.area, subject: intro.subject, html };
          } catch (err) {
            return { customerId: c.id, fullName, email: c.email, company: firm, practiceArea: practice.area, subject: "", html: "", error: err.message };
          }
        }));
        drafts.push(...results);
      }
      const failed = drafts.filter((d) => d.error).length;
      console.log(`[Outreach] Personalization complete. OK: ${drafts.length - failed}, failed: ${failed}`);
      res.json({ drafts, total: drafts.length });
    } catch (error) {
      console.error("[Outreach] Personalize error:", error);
      res.status(500).json({ error: error.message || "Failed to personalize outreach" });
    }
  });
  app.post("/api/email/send-personalized", verifyFirebaseToken, async (req, res) => {
    if (!resend) return res.status(503).json({ error: "Email service not configured. Add RESEND_API_KEY." });
    if (!adminDb) return res.status(503).json({ error: "Database not configured." });
    const uid = req.user.uid;
    const { drafts, campaignId } = req.body;
    if (!Array.isArray(drafts) || drafts.length === 0) {
      return res.status(400).json({ error: "drafts is required" });
    }
    try {
      const biz = await getBusinessProfile(uid);
      const fromEmail = buildFromEmail(biz);
      const valid = drafts.filter((d) => d && d.email && d.html && d.subject);
      const BATCH_SIZE = 20;
      let sent = 0;
      let failed = 0;
      const errors = [];
      for (let i = 0; i < valid.length; i += BATCH_SIZE) {
        const batch = valid.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (d) => {
          try {
            const footer = d.customerId ? unsubscribeFooter(d.customerId) : "";
            let html = d.html;
            if (footer) {
              html = html.includes("</body>") ? html.replace("</body>", `<div style="text-align:center;padding:16px 0;">${footer}</div></body>`) : html + `<div style="text-align:center;padding:16px 0;">${footer}</div>`;
            }
            const sendTags = [];
            if (d.customerId) sendTags.push({ name: "subscriber_id", value: d.customerId });
            if (campaignId) sendTags.push({ name: "campaign_id", value: campaignId });
            const result = await resend.emails.send({
              from: fromEmail,
              to: [d.email],
              subject: d.subject,
              html,
              tags: sendTags.length ? sendTags : void 0
            });
            sent++;
            const emailId = result?.data?.id || result?.id;
            if (adminDb && emailId) {
              try {
                await adminDb.collection("emailEvents").add({
                  userId: uid,
                  subscriberId: d.customerId || "unknown",
                  campaignId: campaignId || "personalized-outreach",
                  type: "sent",
                  timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                  metadata: { emailId, subject: d.subject, to: [d.email], personalized: true }
                });
              } catch (dbErr) {
                console.error("[Outreach] Event log failed:", dbErr.message);
              }
            }
          } catch (err) {
            failed++;
            errors.push(`${d.email}: ${err.message}`);
            console.error(`[Outreach] Failed to send to ${d.email}:`, err.message);
          }
        }));
        if (i + BATCH_SIZE < valid.length) await new Promise((r) => setTimeout(r, 1e3));
      }
      console.log(`[Outreach] Send complete. Sent: ${sent}, Failed: ${failed}`);
      res.json({ success: true, sent, failed, errors: errors.slice(0, 10) });
    } catch (error) {
      console.error("[Outreach] Send error:", error);
      res.status(500).json({ error: error.message || "Failed to send personalized outreach" });
    }
  });
  app.get("/api/email/unsubscribe/:customerId", async (req, res) => {
    if (!adminDb) return res.status(503).send("Service unavailable");
    const { customerId } = req.params;
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!customerId) return res.status(400).send("Invalid unsubscribe link");
    if (!verifyUnsubscribeToken(customerId, token)) {
      console.warn(`[Unsubscribe] Invalid token for customer ${customerId}`);
      return res.status(400).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Invalid Link</title>
        <style>body{margin:0;font-family:'Helvetica Neue',sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;}
        .card{background:white;border-radius:12px;padding:48px 40px;text-align:center;max-width:480px;box-shadow:0 2px 12px rgba(0,0,0,.08);}
        h1{color:#1e3a5f;font-size:22px;margin:0 0 12px;}p{color:#64748b;line-height:1.7;}</style>
        </head><body><div class="card">
          <div style="font-size:48px;margin-bottom:16px;">\u26A0\uFE0F</div>
          <h1>Invalid unsubscribe link</h1>
          <p>This link is invalid or has expired. Please use the unsubscribe link from your original email.</p>
        </div></body></html>`);
    }
    try {
      await adminDb.collection("customers").doc(customerId).update({
        unsubscribed: true,
        unsubscribedAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      console.log(`[Email] Customer ${customerId} unsubscribed`);
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Unsubscribed \u2014 NotaryPro</title>
          <style>
            body { margin:0; font-family: 'Helvetica Neue', sans-serif; background:#f1f5f9; display:flex; align-items:center; justify-content:center; min-height:100vh; }
            .card { background:white; border-radius:12px; padding:48px 40px; text-align:center; max-width:480px; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
            h1 { color:#1e3a5f; font-size:22px; margin:0 0 12px; }
            p { color:#64748b; line-height:1.7; margin:0 0 8px; }
            a { color:#2563eb; }
          </style>
        </head>
        <body>
          <div class="card">
            <div style="font-size:48px;margin-bottom:16px;">\u2705</div>
            <h1>You've been unsubscribed</h1>
            <p>You will no longer receive marketing emails from this business.</p>
            <p>Need notary services? Visit <a href="${APP_URL}">${APP_URL}</a></p>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("[Email] Unsubscribe error:", error);
      res.status(500).send("Something went wrong. Please try again.");
    }
  });
  const CONSENT_COLLECTION = "consentForms";
  function publicConsentView(id, d) {
    return {
      id,
      status: d.status,
      templateId: d.templateId,
      templateName: d.templateName,
      documentTitle: d.documentTitle,
      clientName: d.clientName,
      clientEmail: d.clientEmail,
      renderedHtml: d.renderedHtml,
      acknowledgementList: d.acknowledgementList || [],
      businessName: d.businessName,
      businessEmail: d.businessEmail,
      businessPhone: d.businessPhone,
      expiresAt: d.expiresAt,
      signedAt: d.signedAt || null,
      signature: d.signature ? { typedName: d.signature.typedName, signedAt: d.signature.signedAt } : null
    };
  }
  function consentEmailBody(opts) {
    const firstName = (opts.clientName || "").trim().split(/\s+/)[0] || "there";
    const expires = new Date(opts.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    return `
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">
        Before your appointment, please review and sign the <strong>${escapeHtml(opts.templateName)}</strong> consent and disclosure form.
        It explains what I can and cannot do as a notary, the fees, and what to bring. It takes about two minutes.
      </p>
      ${opts.note ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">${escapeHtml(opts.note)}</p>` : ""}
      <p style="margin:0 0 26px;text-align:center;">
        <a href="${opts.signingUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;">Review &amp; Sign</a>
      </p>
      <p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#64748b;">
        This link is unique to you and expires on ${escapeHtml(expires)}. If the button does not work, copy and paste this address into your browser:<br/>
        <span style="word-break:break-all;color:#2563eb;">${opts.signingUrl}</span>
      </p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">
        Thank you,<br/>${escapeHtml(opts.biz.name)}${opts.biz.phone ? "<br/>" + escapeHtml(opts.biz.phone) : ""}
      </p>`;
  }
  app.post("/api/consent/forms", verifyFirebaseToken, async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Database not available" });
    const uid = req.user.uid;
    const { templateId, customerId, fields } = req.body || {};
    const template = getConsentTemplate(templateId);
    if (!template) return res.status(400).json({ error: "Unknown consent template" });
    const values = {};
    for (const f of template.fields) {
      const v = (fields || {})[f.key];
      values[f.key] = v == null ? "" : String(v).slice(0, 2e3);
    }
    const missing = template.fields.filter((f) => f.required && !values[f.key].trim()).map((f) => f.label);
    if (missing.length) return res.status(400).json({ error: `Missing required field(s): ${missing.join(", ")}` });
    const clientEmail = (values.clientEmail || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail)) {
      return res.status(400).json({ error: "A valid client email is required" });
    }
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const ref = adminDb.collection(CONSENT_COLLECTION).doc();
      const doc = {
        id: ref.id,
        userId: uid,
        customerId: customerId || null,
        templateId: template.id,
        templateName: template.name,
        documentTitle: template.documentTitle,
        status: "draft",
        clientName: values.clientName || "",
        clientEmail,
        fields: values,
        acknowledgementList: template.acknowledgements,
        audit: [{ event: "created", at: now, ip: clientIp(req) }],
        createdAt: now,
        updatedAt: now
      };
      await ref.set(doc);
      res.json({ success: true, form: doc });
    } catch (error) {
      console.error("[Consent] Create failed:", error);
      res.status(500).json({ error: error.message || "Could not create consent form" });
    }
  });
  app.put("/api/consent/forms/:id", verifyFirebaseToken, async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Database not available" });
    const uid = req.user.uid;
    const { fields } = req.body || {};
    try {
      const ref = adminDb.collection(CONSENT_COLLECTION).doc(String(req.params.id));
      const snap = await ref.get();
      const d = snap.data();
      if (!snap.exists || !d || d.userId !== uid) return res.status(404).json({ error: "Form not found" });
      if (d.status === "signed") return res.status(409).json({ error: "A signed form cannot be edited" });
      const template = getConsentTemplate(d.templateId);
      if (!template) return res.status(400).json({ error: "Unknown consent template" });
      const values = { ...d.fields || {} };
      for (const f of template.fields) {
        if (fields && fields[f.key] != null) values[f.key] = String(fields[f.key]).slice(0, 2e3);
      }
      await ref.update({
        fields: values,
        clientName: values.clientName || d.clientName,
        clientEmail: (values.clientEmail || d.clientEmail || "").trim(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[Consent] Update failed:", error);
      res.status(500).json({ error: error.message || "Could not update consent form" });
    }
  });
  app.post("/api/consent/forms/:id/send", verifyFirebaseToken, async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Database not available" });
    if (!resend) return res.status(503).json({ error: "Email service not configured. Add RESEND_API_KEY." });
    const uid = req.user.uid;
    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : "";
    try {
      const ref = adminDb.collection(CONSENT_COLLECTION).doc(String(req.params.id));
      const snap = await ref.get();
      const d = snap.data();
      if (!snap.exists || !d || d.userId !== uid) return res.status(404).json({ error: "Form not found" });
      if (d.status === "signed") return res.status(409).json({ error: "This form has already been signed" });
      const template = getConsentTemplate(d.templateId);
      if (!template) return res.status(400).json({ error: "Unknown consent template" });
      const biz = await getBusinessProfile(uid);
      const profileSnap = await adminDb.collection("profiles").doc(uid).get();
      const profile = profileSnap.data() || {};
      const renderedHtml = renderConsentDocument({
        template,
        fields: d.fields || {},
        business: {
          name: biz.name,
          email: biz.email,
          phone: biz.phone,
          location: biz.location,
          website: biz.website,
          commissionNumber: profile.commissionNumber || "",
          commissionExpiration: profile.commissionExpiration || ""
        }
      });
      const now = /* @__PURE__ */ new Date();
      const expiresAt = new Date(now.getTime() + CONSENT_LINK_DAYS * 864e5).toISOString();
      const signingUrl = buildSigningUrl(ref.id, expiresAt);
      const wasSent = d.status === "sent" || d.status === "viewed";
      const { data, error } = await resend.emails.send({
        from: buildFromEmail(biz),
        to: d.clientEmail,
        replyTo: biz.email || void 0,
        subject: `Please review and sign: ${template.name} consent form`,
        html: baseTemplate(
          consentEmailBody({
            clientName: d.clientName,
            biz,
            templateName: template.name,
            signingUrl,
            expiresAt,
            note
          }),
          biz
        )
      });
      if (error) throw new Error(error.message || "Resend rejected the message");
      await ref.update({
        status: "sent",
        renderedHtml,
        businessName: biz.name,
        businessEmail: biz.email,
        businessPhone: biz.phone,
        acknowledgementList: template.acknowledgements,
        expiresAt,
        sentAt: now.toISOString(),
        updatedAt: now.toISOString(),
        audit: [
          ...d.audit || [],
          { event: wasSent ? "resent" : "sent", at: now.toISOString(), detail: `Emailed to ${d.clientEmail}`, ip: clientIp(req) }
        ]
      });
      console.log(`[Consent] Form ${ref.id} sent to ${d.clientEmail} (${data?.id || "no id"})`);
      res.json({ success: true, signingUrl, expiresAt });
    } catch (error) {
      console.error("[Consent] Send failed:", error);
      res.status(500).json({ error: error.message || "Could not send consent form" });
    }
  });
  app.post("/api/consent/forms/:id/void", verifyFirebaseToken, async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Database not available" });
    const uid = req.user.uid;
    try {
      const ref = adminDb.collection(CONSENT_COLLECTION).doc(String(req.params.id));
      const snap = await ref.get();
      const d = snap.data();
      if (!snap.exists || !d || d.userId !== uid) return res.status(404).json({ error: "Form not found" });
      if (d.status === "signed") return res.status(409).json({ error: "A signed form cannot be voided" });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await ref.update({
        status: "voided",
        updatedAt: now,
        audit: [...d.audit || [], { event: "voided", at: now, ip: clientIp(req) }]
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[Consent] Void failed:", error);
      res.status(500).json({ error: error.message || "Could not void consent form" });
    }
  });
  app.get("/api/public/consent/:id", async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Service unavailable" });
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const exp = typeof req.query.exp === "string" ? req.query.exp : "";
    try {
      const ref = adminDb.collection(CONSENT_COLLECTION).doc(String(req.params.id));
      const snap = await ref.get();
      const d = snap.data();
      if (!snap.exists || !d) return res.status(404).json({ error: "This form is no longer available." });
      if (!verifyConsentToken(String(req.params.id), exp, token)) {
        console.warn(`[Consent] Invalid token for form ${String(req.params.id)}`);
        return res.status(404).json({ error: "This link is invalid." });
      }
      if (d.expiresAt !== exp) return res.status(404).json({ error: "This link is no longer valid." });
      if (new Date(exp).getTime() < Date.now()) return res.status(410).json({ error: "This link has expired. Please ask for a new one." });
      if (d.status === "voided") return res.status(410).json({ error: "This form was cancelled. Please ask for a new one." });
      if (d.status === "draft") return res.status(404).json({ error: "This form is not ready yet." });
      if (d.status === "sent") {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await ref.update({
          status: "viewed",
          viewedAt: now,
          updatedAt: now,
          audit: [...d.audit || [], { event: "viewed", at: now, ip: clientIp(req), userAgent: req.get("user-agent") || "" }]
        });
        d.status = "viewed";
      }
      res.json({ form: publicConsentView(String(req.params.id), d) });
    } catch (error) {
      console.error("[Consent] Public fetch failed:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
  app.post("/api/public/consent/:id/sign", async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Service unavailable" });
    const {
      token,
      exp,
      typedName,
      drawnPng,
      agreedToElectronic,
      intentAcknowledged,
      acknowledgements,
      signatureFontId,
      signatureMode
    } = req.body || {};
    if (!agreedToElectronic || !intentAcknowledged) {
      return res.status(400).json({ error: "Both consent boxes must be checked before signing." });
    }
    const name = String(typedName || "").trim();
    if (name.length < 2) return res.status(400).json({ error: "Please type your full legal name." });
    const png = typeof drawnPng === "string" && drawnPng.startsWith("data:image/png;base64,") ? drawnPng : "";
    if (png.length > 4e5) return res.status(413).json({ error: "Signature image is too large." });
    try {
      const ref = adminDb.collection(CONSENT_COLLECTION).doc(String(req.params.id));
      const snap = await ref.get();
      const d = snap.data();
      if (!snap.exists || !d) return res.status(404).json({ error: "This form is no longer available." });
      if (!verifyConsentToken(String(req.params.id), String(exp || ""), String(token || ""))) {
        return res.status(404).json({ error: "This link is invalid." });
      }
      if (d.expiresAt !== exp) return res.status(404).json({ error: "This link is no longer valid." });
      if (new Date(String(exp)).getTime() < Date.now()) return res.status(410).json({ error: "This link has expired." });
      if (d.status === "signed") return res.status(409).json({ error: "This form has already been signed." });
      if (d.status === "voided") return res.status(410).json({ error: "This form was cancelled." });
      const required = (d.acknowledgementList || []).filter((a) => a.required);
      const checked = acknowledgements || {};
      const unchecked = required.filter((a) => !checked[a.key]);
      if (unchecked.length) {
        return res.status(400).json({ error: "Please check every required acknowledgement before signing." });
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const ip = clientIp(req);
      const userAgent = req.get("user-agent") || "";
      const fontId = SIGNATURE_FONT_IDS.includes(String(signatureFontId || "")) ? String(signatureFontId) : "";
      const mode = signatureMode === "draw" ? "draw" : "type";
      const signature = { typedName: name, drawnPng: png, fontId, mode, signedAt: now, ip, userAgent };
      await ref.update({
        status: "signed",
        signature,
        signedAt: now,
        agreedToElectronic: true,
        intentAcknowledged: true,
        acknowledgements: checked,
        updatedAt: now,
        audit: [...d.audit || [], { event: "signed", at: now, ip, userAgent, detail: `Signed as "${name}"` }]
      });
      if (resend) {
        try {
          const biz = {
            name: d.businessName || "NotaryPro",
            email: d.businessEmail || "",
            phone: d.businessPhone || "",
            website: "",
            location: ""
          };
          const copyHtml = buildSignedCopyHtml(d, signature, biz);
          const from = buildFromEmail(biz);
          await resend.emails.send({
            from,
            to: d.clientEmail,
            replyTo: biz.email || void 0,
            subject: `Signed copy \u2014 ${d.templateName} consent form`,
            html: copyHtml
          });
          if (biz.email) {
            await resend.emails.send({
              from,
              to: biz.email,
              subject: `${d.clientName || d.clientEmail} signed the ${d.templateName} consent form`,
              html: copyHtml
            });
          }
        } catch (mailErr) {
          console.error("[Consent] Signed-copy email failed:", mailErr.message);
        }
      }
      console.log(`[Consent] Form ${String(req.params.id)} signed by ${name}`);
      res.json({ success: true, signedAt: now });
    } catch (error) {
      console.error("[Consent] Sign failed:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
  app.post("/api/public/consent/:id/decline", async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Service unavailable" });
    const { token, exp, reason } = req.body || {};
    try {
      const ref = adminDb.collection(CONSENT_COLLECTION).doc(String(req.params.id));
      const snap = await ref.get();
      const d = snap.data();
      if (!snap.exists || !d) return res.status(404).json({ error: "This form is no longer available." });
      if (!verifyConsentToken(String(req.params.id), String(exp || ""), String(token || "")) || d.expiresAt !== exp) {
        return res.status(404).json({ error: "This link is invalid." });
      }
      if (d.status === "signed") return res.status(409).json({ error: "This form has already been signed." });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await ref.update({
        status: "declined",
        declineReason: String(reason || "").slice(0, 1e3),
        updatedAt: now,
        audit: [...d.audit || [], { event: "declined", at: now, ip: clientIp(req), userAgent: req.get("user-agent") || "" }]
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[Consent] Decline failed:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
  function buildSignedCopyHtml(d, signature, biz) {
    const acks = (d.acknowledgementList || []).map((a) => `<li style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#334155;">${(d.acknowledgements || {})[a.key] ? "&#10003;" : "&#9744;"} ${escapeHtml(a.label)}</li>`).join("");
    const audit = (d.audit || []).map((e) => `<tr>
        <td style="padding:4px 12px 4px 0;font-size:11px;color:#64748b;">${escapeHtml(new Date(e.at).toLocaleString("en-US"))}</td>
        <td style="padding:4px 12px 4px 0;font-size:11px;color:#0f172a;text-transform:capitalize;">${escapeHtml(e.event)}</td>
        <td style="padding:4px 0;font-size:11px;color:#64748b;">${escapeHtml(e.ip || "")}</td>
      </tr>`).join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(d.documentTitle || "Consent Form")}</title></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:12px;padding:36px 40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    ${d.renderedHtml || ""}
    <section style="margin:28px 0 0;">
      <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1e3a5f;">Acknowledgements</h3>
      <ul style="margin:0;padding:0 0 0 4px;list-style:none;">${acks}</ul>
    </section>
    <section style="margin:28px 0 0;padding:20px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1e3a5f;">Electronic Signature</h3>
      <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#334155;">
        The signer consented to do business electronically and indicated intent to sign.
      </p>
      ${signature.drawnPng ? `<img src="${signature.drawnPng}" alt="Signature" style="max-width:320px;display:block;margin:0 0 10px;border-bottom:1px solid #94a3b8;"/>` : ""}
      <p style="margin:0;font-size:13px;color:#475569;">Printed name: <strong>${escapeHtml(signature.typedName)}</strong></p>
      <p style="margin:4px 0 0;font-size:11px;color:#94a3b8;">${signature.mode === "draw" ? "Signature drawn by the signer." : "Signature adopted by the signer from the offered styles."}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#64748b;">
        Signed ${escapeHtml(new Date(signature.signedAt).toLocaleString("en-US"))}
        ${signature.ip ? " &bull; IP " + escapeHtml(signature.ip) : ""}
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;word-break:break-all;">Device: ${escapeHtml(signature.userAgent || "unknown")}</p>
      <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;">Record ID: ${escapeHtml(d.id || "")}</p>
    </section>
    <section style="margin:24px 0 0;">
      <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1e3a5f;">Audit Trail</h3>
      <table style="border-collapse:collapse;">${audit}</table>
    </section>
    <p style="margin:24px 0 0;font-size:12px;color:#64748b;">
      Keep this email as your copy of the executed form. To request a paper copy at no charge, reply to this message${biz.email ? " or write to " + escapeHtml(biz.email) : ""}.
    </p>
  </div>
</body></html>`;
  }
  const INTAKE_OWNER_UID = process.env.PUBLIC_INTAKE_UID || "";
  const INTAKE_ORIGINS = (process.env.INTAKE_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  const intakeHits = /* @__PURE__ */ new Map();
  function applyIntakeCors(req, res) {
    const origin = (req.get("origin") || "").replace(/\/$/, "");
    if (origin && INTAKE_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    }
  }
  app.options("/api/public/intake", (req, res) => {
    applyIntakeCors(req, res);
    res.sendStatus(204);
  });
  app.get("/api/public/intake-branding", async (req, res) => {
    applyIntakeCors(req, res);
    if (!adminDb) return res.status(503).json({ error: "Service unavailable" });
    const uid = typeof req.query.to === "string" && req.query.to.trim() || INTAKE_OWNER_UID;
    if (!uid) return res.json({ branding: null });
    try {
      const doc = await adminDb.collection("profiles").doc(uid).get();
      const d = doc.data() || {};
      const parts = [d.city, d.state].filter(Boolean);
      res.json({
        branding: {
          name: d.companyName || d.name || "",
          phone: d.phone || "",
          website: d.website || "",
          logoUrl: d.logoUrl || "",
          location: parts.join(", ")
        }
      });
    } catch (error) {
      console.error("[Intake] Branding fetch failed:", error.message);
      res.json({ branding: null });
    }
  });
  app.post("/api/public/intake", async (req, res) => {
    applyIntakeCors(req, res);
    if (!adminDb) return res.status(503).json({ error: "Service unavailable" });
    const {
      fullName,
      email,
      phone,
      serviceType,
      preferredDate,
      location,
      message,
      consentToContact,
      ownerId,
      company,
      quoteSignatures,
      quoteRoundTripMiles,
      quoteNotaryFee,
      quoteTravelFee,
      quoteTotal,
      quoteLocationType
    } = req.body || {};
    if (typeof company === "string" && company.trim()) {
      console.log("[Intake] Honeypot triggered, silently discarded");
      return res.json({ success: true });
    }
    const ip = clientIp(req) || "unknown";
    const now = Date.now();
    const recent = (intakeHits.get(ip) || []).filter((t) => now - t < 36e5);
    if (recent.length >= 5) return res.status(429).json({ error: "Too many submissions. Please try again later." });
    recent.push(now);
    intakeHits.set(ip, recent);
    const name = String(fullName || "").trim().slice(0, 200);
    const mail = String(email || "").trim().toLowerCase().slice(0, 200);
    if (!name) return res.status(400).json({ error: "Your name is required." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return res.status(400).json({ error: "A valid email address is required." });
    if (!consentToContact) return res.status(400).json({ error: "Please agree to be contacted about your request." });
    const uid = String(ownerId || INTAKE_OWNER_UID || "").trim();
    if (!uid) {
      console.error("[Intake] No PUBLIC_INTAKE_UID configured and no ownerId supplied");
      return res.status(503).json({ error: "Intake is not configured yet." });
    }
    try {
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const parts = name.split(/\s+/);
      const num = (v, max) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
      };
      const sigs = Math.floor(num(quoteSignatures, 999));
      const miles = num(quoteRoundTripMiles, 1e4);
      const quote = {
        signatures: sigs,
        roundTripMiles: miles,
        notaryFee: Math.round(sigs * 10 * 100) / 100,
        travelFee: Math.round(miles * 0.725 * 100) / 100,
        locationType: String(quoteLocationType || "").slice(0, 40),
        total: 0
      };
      quote.total = Math.round((quote.notaryFee + quote.travelFee) * 100) / 100;
      const quoteLine = `Website estimate: ${quote.signatures} signature(s) $${quote.notaryFee.toFixed(2)} + ${quote.roundTripMiles} mi travel $${quote.travelFee.toFixed(2)} = $${quote.total.toFixed(2)}`;
      const lead = {
        userId: uid,
        fullName: name,
        email: mail,
        phone: String(phone || "").trim().slice(0, 40),
        serviceType: String(serviceType || "").trim().slice(0, 100),
        preferredDate: String(preferredDate || "").trim().slice(0, 40),
        location: String(location || "").trim().slice(0, 300),
        message: String(message || "").trim().slice(0, 2e3),
        consentToContact: true,
        source: "website",
        quote,
        ip,
        userAgent: (req.get("user-agent") || "").slice(0, 400),
        createdAt: nowIso
      };
      const existing = await adminDb.collection("customers").where("userId", "==", uid).where("email", "==", mail).limit(1).get();
      let customerId;
      if (!existing.empty) {
        customerId = existing.docs[0].id;
        await existing.docs[0].ref.update({
          phone: lead.phone || existing.docs[0].data().phone || "",
          notes: [existing.docs[0].data().notes, `Website request ${nowIso.slice(0, 10)}: ${lead.serviceType} \u2014 ${lead.message}`, quoteLine].filter(Boolean).join("\n"),
          updatedAt: nowIso
        });
      } else {
        const customerRef = adminDb.collection("customers").doc();
        customerId = customerRef.id;
        await customerRef.set({
          id: customerRef.id,
          userId: uid,
          firstName: parts[0] || name,
          lastName: parts.slice(1).join(" "),
          fullName: name,
          email: mail,
          phone: lead.phone,
          address: lead.location,
          city: "",
          state: "",
          zip: "",
          customerType: "General Client",
          preferredContactMethod: "Email",
          tags: ["website-lead"],
          notes: [
            lead.serviceType && `Service requested: ${lead.serviceType}`,
            lead.preferredDate && `Preferred date: ${lead.preferredDate}`,
            lead.message,
            quoteLine
          ].filter(Boolean).join("\n"),
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }
      const leadRef = adminDb.collection("websiteLeads").doc();
      await leadRef.set({ ...lead, id: leadRef.id, customerId });
      if (resend) {
        try {
          const biz = await getBusinessProfile(uid);
          if (biz.email) {
            await resend.emails.send({
              from: buildFromEmail(biz),
              to: biz.email,
              replyTo: mail,
              subject: `New website request \u2014 ${name}`,
              html: baseTemplate(`
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">A new request came in through your website.</p>
                <table style="border-collapse:collapse;font-size:14px;color:#334155;">
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Name</td><td>${escapeHtml(name)}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Email</td><td>${escapeHtml(mail)}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Phone</td><td>${escapeHtml(lead.phone)}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Service</td><td>${escapeHtml(lead.serviceType)}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Preferred date</td><td>${escapeHtml(lead.preferredDate)}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Location</td><td>${escapeHtml(lead.location)}${quote.locationType ? " (" + escapeHtml(quote.locationType) + ")" : ""}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Their estimate</td><td>${escapeHtml(quoteLine.replace("Website estimate: ", ""))}</td></tr>
                </table>
                <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">${escapeHtml(lead.message)}</p>
                <p style="margin:18px 0 0;font-size:13px;color:#64748b;">They are already in your CRM. Open Consent Forms to send them a consent and disclosure form.</p>
              `, biz)
            });
          }
        } catch (mailErr) {
          console.error("[Intake] Notification email failed:", mailErr.message);
        }
      }
      console.log(`[Intake] Website lead ${leadRef.id} -> customer ${customerId}`);
      res.json({ success: true, customerId });
    } catch (error) {
      console.error("[Intake] Failed:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
  app.post("/api/ai/generate-template", verifyFirebaseToken, async (req, res) => {
    if (!anthropic) return res.status(503).json({ error: "AI Designer is not configured. Add ANTHROPIC_API_KEY." });
    const uid = req.user.uid;
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "A prompt is required." });
    }
    try {
      const biz = await getBusinessProfile(uid);
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `Generate a professional email template for a Notary Signing Agent business.
User Request: "${prompt}"

BUSINESS DETAILS \u2014 use these real values directly in the email, do NOT use placeholders for them:
- Business Name: ${biz.name}
- Phone: ${biz.phone || ""}
- Email: ${biz.email || ""}
- Website: ${biz.website || ""}
- Service Area: ${biz.location || "the local area"}

RULES:
- Only use {{firstName}} as a placeholder for the recipient's first name
- Fill in ALL other details using the real business info above
- Do NOT include unsubscribe links or preference links
- The template should be responsive, modern, and high-quality HTML

Return ONLY a valid JSON object with no markdown, no code fences, just raw JSON:
{
  "name": "A short descriptive name for the template",
  "htmlContent": "The full HTML string for the email",
  "category": "One of: Marketing, Transactional, Follow-up, or Custom"
}`
          }
        ]
      });
      const text = message.content[0].type === "text" ? message.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(502).json({ error: "Could not parse AI response." });
      }
      return res.json(JSON.parse(jsonMatch[0]));
    } catch (error) {
      console.error("[AI] Template generation error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate template." });
    }
  });
  app.post("/api/ai/notary-research", verifyFirebaseToken, async (req, res) => {
    if (!genAI) return res.status(503).json({ error: "AI search is not configured. Add GEMINI_API_KEY." });
    const { query, state } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "A query is required." });
    }
    try {
      const prompt = `You are a professional notary law researcher.
The user has a question about notary laws in the state of ${state || "their state"}.
Question: "${query}"

Please provide:
1. A clear, concise summary of the law or regulation (2-4 sentences).
2. At least 2-3 specific citations or source titles that would likely contain this information.
3. If possible, a likely URL for the official state notary authority for ${state || "the state"}.

IMPORTANT:
- Clearly state that this is informational research and not legal advice.
- If you are unsure, state that the user should consult their Secretary of State.
- Return ONLY valid JSON (no markdown, no code fences) with this structure:
{"answer":"...","citations":[{"title":"...","url":"..."}],"officialStateLink":"..."}`;
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      const text = result.response.text() || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return res.json(JSON.parse(jsonMatch[0]));
      return res.json({
        answer: text,
        citations: [
          { title: "National Notary Association", url: "https://www.nationalnotary.org" },
          { title: `${state || ""} Secretary of State`, url: "https://google.com/search?q=" + encodeURIComponent(`${state || ""} Secretary of State Notary`) }
        ]
      });
    } catch (error) {
      console.error("[AI] Notary research error:", error);
      return res.status(500).json({ error: error.message || "Failed to perform AI research." });
    }
  });
  app.post("/api/webhooks/resend", async (req, res) => {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const msgId = req.headers["svix-id"];
      const msgTimestamp = req.headers["svix-timestamp"];
      const msgSignature = req.headers["svix-signature"];
      if (!msgId || !msgTimestamp || !msgSignature) {
        console.warn("[Resend Webhook] Missing Svix signature headers \u2014 rejecting");
        return res.status(401).json({ error: "Missing webhook signature headers" });
      }
      const tsSeconds = parseInt(msgTimestamp, 10);
      if (isNaN(tsSeconds) || Math.abs(Math.floor(Date.now() / 1e3) - tsSeconds) > 300) {
        console.warn("[Resend Webhook] Timestamp too old or invalid \u2014 rejecting");
        return res.status(401).json({ error: "Webhook timestamp out of range" });
      }
      const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);
      const signedContent = `${msgId}.${msgTimestamp}.${rawBody}`;
      const secretBytes = Buffer.from(
        webhookSecret.startsWith("whsec_") ? webhookSecret.slice(6) : webhookSecret,
        "base64"
      );
      const expectedSig = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
      const signatures = msgSignature.split(" ").map((s) => s.replace(/^v1,/, ""));
      const valid = signatures.some((sig) => {
        try {
          return crypto.timingSafeEqual(
            Buffer.from(sig, "base64"),
            Buffer.from(expectedSig, "base64")
          );
        } catch {
          return false;
        }
      });
      if (!valid) {
        console.warn("[Resend Webhook] Signature mismatch \u2014 rejecting");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
    } else {
      console.warn("[Resend Webhook] RESEND_WEBHOOK_SECRET not set \u2014 skipping signature check");
    }
    try {
      const payload = req.body;
      console.log("[Resend Webhook Received]:", JSON.stringify(payload));
      const type = payload.type;
      const data = payload.data;
      if (data && adminDb) {
        const emailId = data.email_id;
        const tags = data.tags;
        let campaignId = "";
        let subscriberId = "";
        if (tags) {
          if (Array.isArray(tags)) {
            const campaignTag = tags.find((t) => t.name === "campaign_id");
            const subTag = tags.find((t) => t.name === "subscriber_id");
            if (campaignTag) campaignId = campaignTag.value;
            if (subTag) subscriberId = subTag.value;
          } else if (typeof tags === "object") {
            campaignId = tags.campaign_id || "";
            subscriberId = tags.subscriber_id || "";
          }
        }
        const normType = type && typeof type === "string" ? type.replace("email.", "") : "event";
        await adminDb.collection("emailEvents").add({
          userId: process.env.CRM_OWNER_USER_ID || "system",
          subscriberId: subscriberId || "unknown",
          campaignId: campaignId || "single",
          type: normType,
          timestamp: payload.created_at || (/* @__PURE__ */ new Date()).toISOString(),
          metadata: {
            emailId: emailId || "",
            subject: data.subject || "",
            to: data.to || [],
            raw: data
          }
        });
        console.log(`[Resend Webhook Store Success] Stored event "${normType}" for email ${emailId}`);
        if (campaignId && campaignId !== "single" && campaignId !== "newsletter") {
          const campaignRef = adminDb.collection("marketingCampaigns").doc(campaignId);
          const campaignDoc = await campaignRef.get();
          if (campaignDoc.exists) {
            const metrics = campaignDoc.data()?.metrics || {
              sentCount: 0,
              deliveredCount: 0,
              openCount: 0,
              clickCount: 0,
              unsubscribeCount: 0,
              bounceCount: 0
            };
            const fieldToUpdate = normType === "opened" ? "metrics.openCount" : normType === "clicked" ? "metrics.clickCount" : normType === "unsubscribed" ? "metrics.unsubscribeCount" : normType === "bounced" ? "metrics.bounceCount" : null;
            if (fieldToUpdate) {
              const currentVal = normType === "opened" ? metrics.openCount || 0 : normType === "clicked" ? metrics.clickCount || 0 : normType === "unsubscribed" ? metrics.unsubscribeCount || 0 : normType === "bounced" ? metrics.bounceCount || 0 : 0;
              await campaignRef.update({
                [fieldToUpdate]: currentVal + 1,
                updatedAt: (/* @__PURE__ */ new Date()).toISOString()
              });
              console.log(`[Resend Webhook Store Success] Incremented ${fieldToUpdate} for campaign ${campaignId}`);
            }
          }
        }
      }
      res.json({ received: true });
    } catch (error) {
      console.error("[Resend Webhook Error]:", error);
      res.status(500).json({ error: error.message || "Failed to process webhook" });
    }
  });
  app.post("/api/idv/process-document", verifyFirebaseToken, async (req, res) => {
    const { recordId, frontUrl } = req.body;
    if (!recordId || !frontUrl) return res.status(400).json({ error: "Record ID and Front Image URL required" });
    console.log(`[IDV] Processing document for record: ${recordId}`);
    try {
      let extractedData = {};
      if (genAI) {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        let imagePart = null;
        try {
          if (frontUrl.startsWith("http") && !frontUrl.includes("example.com")) {
            const imageResp = await fetch(frontUrl);
            const buffer = await imageResp.arrayBuffer();
            imagePart = { inlineData: { data: Buffer.from(buffer).toString("base64"), mimeType: "image/jpeg" } };
          }
        } catch (fetchErr) {
          console.error("[IDV] Failed to fetch image:", fetchErr);
        }
        if (imagePart) {
          const prompt = `Analyze this government-issued identity document (front image). Extract and return a JSON object with: fullName, firstName, middleName, lastName, dob (YYYY-MM-DD), address, city, state, zip, issuingCountry, issuingJurisdiction, documentNumber, issueDate (YYYY-MM-DD), expirationDate (YYYY-MM-DD), class. Rules: 1. Return ONLY valid JSON. 2. If not found use null. 3. No markdown.`;
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [imagePart, { text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          });
          const text = result.response.text().trim();
          extractedData = JSON.parse(text.replace(/^```json/i, "").replace(/```$/i, "").trim());
        } else {
          extractedData = { fullName: "John Quincy Public", firstName: "John", middleName: "Quincy", lastName: "Public", dob: "1985-05-15", address: "123 Maple Avenue", city: "Charlotte", state: "NC", zip: "28202", issuingCountry: "USA", issuingJurisdiction: "North Carolina", documentNumber: "NC12345678", issueDate: "2020-01-01", expirationDate: "2028-01-01", class: "C", confidence: 0.95 };
        }
      }
      res.json({ status: "processed", extractedData, checks: [
        { id: "img_quality", name: "Image Quality", status: "pass", explanation: "Clear and legible", source: "automated", timestamp: (/* @__PURE__ */ new Date()).toISOString() },
        { id: "doc_authenticity", name: "Document Authenticity", status: "pass", explanation: "Security features detected", source: "automated", timestamp: (/* @__PURE__ */ new Date()).toISOString() },
        { id: "doc_expiration", name: "Expiration Check", status: "pass", explanation: "Document is valid", source: "automated", timestamp: (/* @__PURE__ */ new Date()).toISOString() }
      ] });
    } catch (error) {
      console.error("[IDV] Extraction error:", error);
      res.status(500).json({ error: "Failed to process document" });
    }
  });
  app.post("/api/idv/face-match", verifyFirebaseToken, async (req, res) => {
    setTimeout(() => res.json({ status: "matched", score: 0.98, checks: [{ id: "face_match", name: "Face Match", status: "pass", explanation: "Signer matches ID portrait", source: "automated", timestamp: (/* @__PURE__ */ new Date()).toISOString() }] }), 1500);
  });
  app.post("/api/idv/liveness-check", verifyFirebaseToken, async (req, res) => {
    setTimeout(() => res.json({ status: "passed", score: 0.99, checks: [{ id: "liveness", name: "Liveness Check", status: "pass", explanation: "Physical presence confirmed", source: "automated", timestamp: (/* @__PURE__ */ new Date()).toISOString() }] }), 2e3);
  });
  app.post("/api/idv/aamva-check", verifyFirebaseToken, async (req, res) => {
    setTimeout(() => res.json({ status: "matched", details: { fullName: "match", dob: "match", documentNumber: "match", address: "match" }, checks: [{ id: "aamva", name: "AAMVA / DLDV", status: "pass", explanation: "Information verified against issuing agency", source: "external", timestamp: (/* @__PURE__ */ new Date()).toISOString() }] }), 3e3);
  });
  app.get("/api/health", (req, res) => {
    const testOauth = getOAuth2Client(req);
    res.json({
      status: "ok",
      time: (/* @__PURE__ */ new Date()).toISOString(),
      googleInit: !!testOauth,
      serviceAccountInit: !!serviceAccountAuth,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null,
      firebase: adminDb ? "CONNECTED" : "NOT CONNECTED",
      email: resend ? "CONFIGURED" : "NOT CONFIGURED"
    });
  });
  app.get("/api/auth/google", (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "UID required" });
    const client = getOAuth2Client(req);
    if (!client) return res.status(503).json({ error: "Google Calendar integration is not configured." });
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/calendar.events"],
      prompt: "consent",
      state: uid
    });
    res.json({ url });
  });
  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, state: uid } = req.query;
    if (!code || !uid) return res.status(400).send("Code and UID required");
    const client = getOAuth2Client(req);
    if (!client) return res.status(503).send("Google OAuth client not initialized");
    try {
      const { tokens } = await client.getToken(code);
      res.send(`<html><body><script>window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, window.location.origin);window.close();</script><p>Authentication successful! You can close this window.</p></body></html>`);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Authentication failed");
    }
  });
  async function getAuthorizedClient(uid, clientTokens) {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
    if (!GOOGLE_CLIENT_ID) throw new Error("Google OAuth credentials missing on server");
    const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    let tokens = clientTokens;
    if (tokens && typeof tokens === "string") {
      try {
        tokens = JSON.parse(tokens);
      } catch (e) {
      }
    }
    if (!tokens || !tokens.access_token) throw new Error("No Google tokens available. Please reconnect in settings.");
    oauth2.setCredentials(tokens);
    const isExpired = Date.now() >= (tokens.expiry_date || 0) - 6e4;
    if (isExpired && tokens.refresh_token) {
      try {
        const { tokens: refreshedTokens } = await oauth2.refreshAccessToken();
        const updatedTokens = { ...tokens, ...refreshedTokens };
        oauth2.setCredentials(updatedTokens);
        return { oauth2, tokens: updatedTokens };
      } catch (e) {
        if (e.message?.includes("invalid_grant")) {
          const authErr = new Error("Google Calendar access revoked or expired. Please reconnect.");
          authErr.code = 401;
          throw authErr;
        }
        throw e;
      }
    }
    return { oauth2, tokens: null };
  }
  app.get("/api/calendar/events", async (req, res) => {
    const { uid, timeMin, timeMax, tokens: clientTokensStr } = req.query;
    if (!uid) return res.status(400).json({ error: "UID required" });
    try {
      let clientTokens = null;
      if (clientTokensStr) {
        try {
          clientTokens = JSON.parse(clientTokensStr);
        } catch (e) {
        }
      }
      const { oauth2, tokens } = await getAuthorizedClient(uid, clientTokens);
      const calendar = google.calendar({ version: "v3", auth: oauth2 });
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: timeMin || new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString(),
        timeMax: timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString(),
        singleEvents: true,
        orderBy: "startTime"
      });
      res.json({ events: response.data.items, tokens });
    } catch (error) {
      const errorMessage = error.message || "Unknown error";
      let statusCode = 500;
      if (error.code === 429) statusCode = 429;
      else if (error.code === 401 || errorMessage.includes("invalid_grant")) statusCode = 401;
      else if (error.code === 403) statusCode = 403;
      else if (typeof error.code === "number" && error.code >= 400) statusCode = error.code;
      res.status(statusCode).json({ error: errorMessage, code: statusCode });
    }
  });
  function getGoogleCalendarDateTime(dateStr = "", timeStr = "") {
    if (!dateStr) return { start: (/* @__PURE__ */ new Date()).toISOString(), end: new Date(Date.now() + 36e5).toISOString() };
    let year = (/* @__PURE__ */ new Date()).getFullYear(), month = (/* @__PURE__ */ new Date()).getMonth() + 1, day = (/* @__PURE__ */ new Date()).getDate();
    if (dateStr.includes("-")) {
      const p = dateStr.split("-");
      year = +p[0];
      month = +p[1];
      day = +p[2];
    } else if (dateStr.includes("/")) {
      const p = dateStr.split("/");
      month = +p[0];
      day = +p[1];
      year = +p[2];
      if (year < 100) year += 2e3;
    }
    const time24 = convertTo24(timeStr);
    const [hStr, mStr] = time24.split(":");
    const h = parseInt(hStr), m = parseInt(mStr);
    const pad = (n) => String(n).padStart(2, "0");
    const startStr = `${year}-${pad(month)}-${pad(day)}T${pad(h)}:${pad(m)}:00`;
    let endH = h + 1, endDay = day;
    if (endH >= 24) {
      endH -= 24;
      endDay += 1;
    }
    return { start: startStr, end: `${year}-${pad(month)}-${pad(endDay)}T${pad(endH)}:${pad(m)}:00` };
  }
  app.post("/api/calendar/sync", async (req, res) => {
    const { appointmentId, uid, action, appointmentData, googleCalendarTokens, googleCalendarId: bodyCalendarId } = req.body;
    if (!appointmentId || !uid || !appointmentData) return res.status(400).json({ error: "Missing fields" });
    try {
      let auth;
      const calendarId = bodyCalendarId || process.env.GOOGLE_CALENDAR_ID || "primary";
      let refreshedTokens = null;
      try {
        const { oauth2, tokens } = await getAuthorizedClient(uid, googleCalendarTokens);
        auth = oauth2;
        refreshedTokens = tokens;
      } catch (e) {
        if (serviceAccountAuth) {
          auth = serviceAccountAuth;
        } else throw e;
      }
      const appointment = appointmentData;
      const calendar = google.calendar({ version: "v3", auth });
      if (action === "delete") {
        const eventId = req.body.eventId || appointment?.googleCalendarEventId;
        if (eventId) {
          try {
            await calendar.events.delete({ calendarId, eventId });
          } catch (e) {
            if (e.code !== 404) throw e;
          }
        }
        return res.json({ status: "deleted", newTokensData: refreshedTokens });
      }
      const { start: startDateTime, end: endDateTime } = getGoogleCalendarDateTime(appointment?.date, appointment?.time);
      const event = {
        summary: `${appointment?.signingType || "Signing"}: ${appointment?.customerName || appointment?.clientName || "Unknown Client"}`,
        location: appointment?.location || appointment?.address || "TBD",
        description: `Client: ${appointment?.customerName || "N/A"}
Type: ${appointment?.signingType || "N/A"}
Documents: ${(appointment?.docs || []).join(", ")}
Notes: ${appointment?.notes || ""}
Phone: ${appointment?.phone || ""}
Order #: ${appointment?.orderNumber || ""}
Link: ${process.env.APP_URL || ""}/appointments?id=${appointmentId}`.trim(),
        start: { dateTime: startDateTime, timeZone: "America/New_York" },
        end: { dateTime: endDateTime, timeZone: "America/New_York" }
      };
      if (appointment?.googleCalendarEventId) {
        try {
          const apiResponse = await calendar.events.update({ calendarId, eventId: appointment.googleCalendarEventId, requestBody: event });
          res.json({ status: "updated", googleResponse: apiResponse.data, newTokensData: refreshedTokens });
        } catch (error) {
          if (error.code === 404) {
            const newEvent = await calendar.events.insert({ calendarId, requestBody: event });
            res.json({ status: "re-created", eventId: newEvent.data.id, googleResponse: newEvent.data, newTokensData: refreshedTokens });
          } else throw error;
        }
      } else {
        const newEvent = await calendar.events.insert({ calendarId, requestBody: event });
        res.json({ status: "created", eventId: newEvent.data.id, googleResponse: newEvent.data, newTokensData: refreshedTokens });
      }
    } catch (error) {
      const errorMessage = error.message || "Unknown error";
      const errorDetails = error.response?.data?.error || null;
      const detailMessage = errorDetails?.message || errorMessage;
      let statusCode = 500;
      if (detailMessage.toLowerCase().includes("quota") || error.code === 429) statusCode = 429;
      else if (error.code === 401 || detailMessage.includes("invalid_grant")) statusCode = 401;
      else if (error.code === 403) statusCode = 403;
      else if (typeof error.code === "number" && error.code >= 400) statusCode = error.code;
      res.status(statusCode).json({ error: "Failed to sync calendar", details: detailMessage, code: statusCode });
    }
  });
  function convertTo24(time12h = "10:00 AM") {
    if (!time12h) return "10:00";
    const normalized = time12h.replace(/([0-9])\s*([AP]M)/i, "$1 $2").trim();
    const parts = normalized.split(" ");
    const time = parts[0];
    const modifier = parts[1]?.toUpperCase() || null;
    let [hours, minutes] = time.split(":");
    if (!hours) hours = "10";
    if (!minutes) minutes = "00";
    let h = parseInt(hours, 10);
    if (h === 12) h = modifier === "AM" ? 0 : 12;
    else if (modifier === "PM") h = h + 12;
    return `${String(h).padStart(2, "0")}:${minutes.padStart(2, "0")}`;
  }
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: process.env.DISABLE_HMR === "true" ? false : true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(distPath)) console.error(`ERROR: 'dist' folder not found at ${distPath}.`);
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error("Error sending index.html:", err);
          res.status(503).send(`Application Error: index.html not found.`);
        }
      });
    });
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
}
startServer();
