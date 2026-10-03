/**
 * Outbound SMS templates, isolated here so wording can be corrected without
 * touching code. Sinhala and Tamil text should be reviewed by native speakers.
 */
const SMS_MESSAGES = Object.freeze({
  acknowledgement: Object.freeze({
    en: 'Report {code} received. An officer will check it. {advice}',
    si: 'වාර්තාව {code} ලැබුණා. නිලධාරියෙකු එය පරීක්ෂා කරයි. {advice}',
    ta: 'அறிக்கை {code} பெறப்பட்டது. அதிகாரி ஒருவர் அதைச் சரிபார்ப்பார். {advice}',
  }),
  acknowledgementQueued: Object.freeze({
    en: 'Report received. An officer will check it. {advice}',
    si: 'වාර්තාව ලැබුණා. නිලධාරියෙකු එය පරීක්ෂා කරයි. {advice}',
    ta: 'அறிக்கை பெறப்பட்டது. அதிகாரி ஒருவர் அதைச் சரிபார்ப்பார். {advice}',
  }),
  callBackNote: Object.freeze({
    en: 'An officer may call you back.',
    si: 'නිලධාරියෙකු ඔබට ආපසු ඇමතිය හැක.',
    ta: 'அதிகாரி ஒருவர் உங்களை மீண்டும் அழைக்கலாம்.',
  }),
  adviceElephant: Object.freeze({
    en: 'Stay away from the elephant.',
    si: 'අලියාගෙන් ඈත්ව සිටින්න.',
    ta: 'யானையிடமிருந்து விலகி இருங்கள்.',
  }),
  adviceInjured: Object.freeze({
    en: 'Call 1990 now if someone is injured.',
    si: 'යමෙකුට තුවාල වී ඇත්නම් දැන්ම 1990 අමතන්න.',
    ta: 'யாருக்காவது காயம் ஏற்பட்டிருந்தால் இப்போதே 1990 ஐ அழைக்கவும்.',
  }),
  adviceGeneral: Object.freeze({
    en: 'Keep a safe distance.',
    si: 'ආරක්ෂිත දුරක් තබා ගන්න.',
    ta: 'பாதுகாப்பான தூரத்தில் இருங்கள்.',
  }),
  outcomeVerified: Object.freeze({
    en: '{code} checked: confirmed. Thank you for reporting.',
    si: '{code} පරීක්ෂා කළා: තහවුරු විය. වාර්තා කිරීමට ස්තූතියි.',
    ta: '{code} சரிபார்க்கப்பட்டது: உறுதி செய்யப்பட்டது. தெரிவித்தமைக்கு நன்றி.',
  }),
  outcomeRejected: Object.freeze({
    en: 'We could not confirm {code}. Thank you for reporting. Please report again if it continues.',
    si: '{code} තහවුරු කිරීමට නොහැකි විය. වාර්තා කිරීමට ස්තූතියි. තවමත් පවතී නම් නැවත වාර්තා කරන්න.',
    ta: '{code} ஐ உறுதிப்படுத்த முடியவில்லை. தெரிவித்தமைக்கு நன்றி. தொடர்ந்தால் மீண்டும் தெரிவிக்கவும்.',
  }),
  /** Format help always lists all three languages (UC3.1 E1). */
  formatHelp: Object.freeze([
    'Send: ALIYA <village>  e.g. ALIYA PALATUPANA',
    'යවන්න: ALIYA <ගම>  උදා: ALIYA PALATUPANA',
    'அனுப்புக: YANAI <கிராமம்>  எ.கா: YANAI PALATUPANA',
  ]),
  unknownPlace: Object.freeze([
    'Place not recognised. Send: ALIYA <village>  e.g. ALIYA PALATUPANA',
    'ස්ථානය හඳුනාගත නොහැක. යවන්න: ALIYA <ගම>  උදා: ALIYA PALATUPANA',
    'இடம் அடையாளம் காணப்படவில்லை. அனுப்புக: YANAI <கிராமம்>  எ.கா: YANAI PALATUPANA',
  ]),
});

module.exports = { SMS_MESSAGES };
