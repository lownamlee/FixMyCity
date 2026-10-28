import { MYKAD_REFERENCES, MYKAD_REFERENCE_VERSION } from './mykad-reference-data.js';

export const MYKAD_LAYOUT_INSTRUCTIONS = `For IC checks, a fixed LAYOUT_REFERENCE_ONLY section precedes USER_CAMERA_EVIDENCE. Those specimens are illustrations of document layouts, NOT submitted user evidence. Their watermarks, redactions, placeholder details, multiple cards, printed copies and example portraits are intentional. Never use them to satisfy a user-evidence check, authenticate a person, or compare a user's face or personal details. Never count specimen portraits or cards as extra subjects in camera evidence. Apply spoof, quality, original-card and consistency checks ONLY to USER_CAMERA_EVIDENCE. Reject a specimen, redacted copy, drawing, screenshot or replay submitted as USER_CAMERA_EVIDENCE even if it matches a reference exactly.
Compare the camera card to ONE coherent applicable MyKad generation, not a mixture of features from all references. Older MyKad layouts remain valid; do not require a newer layout. Legacy blue cards may lack the 2012 secondary portrait. The 2012 family has a main portrait on the right, a smaller security portrait, and the chip on the front. The 2026 family moves the main portrait to the left and the chip to the back, with a back QR code and security portrait/window. A printed security portrait is not a second person. Do not require Touch 'n Go on the 2026 design. These are layout examples, not an exhaustive set of every print variation. Normal wear, lighting and perspective can change appearance. Ordinary RGB frames cannot establish UV, NFC, chip contents or government issuance; do not invent evidence of those properties. A familiar layout is not proof of authenticity. Judge whether the supplied camera evidence supports every required check; retain review when it does not.`;

export function mykadReferenceContent() {
  const content = [{type:'input_text', text:`LAYOUT_REFERENCE_ONLY — fixed bank ${MYKAD_REFERENCE_VERSION}. The following ${MYKAD_REFERENCES.length} images are public specimen sheets, not this user's card.`}];
  for (const reference of MYKAD_REFERENCES) {
    content.push({type:'input_text', text:`LAYOUT_REFERENCE_ONLY ${reference.id}: ${reference.label}`},
      {type:'input_image', image_url:reference.imageUrl, detail:'high'});
  }
  content.push({type:'input_text', text:'END_LAYOUT_REFERENCES. Only the USER_CAMERA_EVIDENCE that follows may satisfy the requested checks.'});
  return content;
}

// Fixed copy only: never expose extracted card text, a model explanation or confidence.
export function cardFailureFeedback(value, kind) {
  const risks = Array.isArray(value?.risk_flags) ? value.risk_flags : [];
  // A specific copy/replay finding must not be hidden by quality_usable=false.
  // The model commonly returns both for the same screenshot.
  if (risks.some(risk => ['screen_replay','screenshot'].includes(risk))) return {
    failureCode:'screen_or_screenshot', message:'This appears to be a screenshot or a photo of a screen. Show your physical MyKad directly to the camera.'};
  if (risks.some(risk => ['paper_copy','drawing','synthetic_or_edited','prompt_injection'].includes(risk))) return {
    failureCode:'original_unconfirmed', message:'We could not confirm an original card. Show your physical MyKad directly to the camera.'};
  if (value?.quality_usable === false || risks.includes('poor_quality')) return {
    failureCode:'capture_unclear', message:'The image is not clear enough. Hold your MyKad steady in even lighting and avoid glare.'};
  if (value?.document_type === 'other' || risks.includes('wrong_document')) return {
    failureCode:'mykad_required', message:'Show your original Malaysian MyKad in the frame.'};
  if (kind === 'ic_front' && value?.front_side_visible === false) return {
    failureCode:'front_required', message:'Show the front of your MyKad, with your portrait visible.'};
  if (kind === 'ic' && value?.back_side_visible === false) return {
    failureCode:'back_required', message:'Turn your MyKad over and show the back.'};
  if (value?.text_readable === false) return {
    failureCode:'text_unclear', message:'Bring your MyKad a little closer until the text is clear. Avoid glare.'};
  if (value?.live_capture_consistent === false || value?.same_card_all_frames === false) return {
    failureCode:'continuity_unclear', message:'Keep the same MyKad in the live camera for a moment while it scans.'};
  if (value?.portrait_usable === false) return {
    failureCode:'portrait_unclear', message:'Keep the portrait on your MyKad clear and uncovered. Avoid glare.'};
  if (kind === 'ic' && (value?.same_physical_card === false || value?.front_back_consistent === false || risks.includes('inconsistent_details'))) return {
    failureCode:'sides_unconfirmed', message:'We could not match both sides. Show the back of the same MyKad clearly.'};
  if (risks.includes('multiple_documents')) return {
    failureCode:'multiple_cards', message:'Keep only your MyKad in view.'};
  return {failureCode:'check_inconclusive', message:'We could not complete the card check confidently. Keep the original MyKad clear, steady and free of glare.'};
}
