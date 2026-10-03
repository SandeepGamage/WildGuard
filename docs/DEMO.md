# Demonstration guide

Prerequisites: README setup done, `npm run seed:demo` run, backend running (`npm run dev`), app running in Expo Go. Demo password = your `DEMO_USER_PASSWORD`.

## Accounts

| Role | Sign in with |
|---|---|
| Villager | `0771234812` (Nimali Perera) |
| Liaison officer | `officer.perera@wildguard.example` |
| Officer outside the main scope | `officer.fernando@wildguard.example` |

## The six assignment flows

**Flow 1 - Language and category (screenshot 1).** Launch the app (first run) -> *Get started* -> choose English / සිංහල / தமிழ் -> *Continue* -> sign in as the villager -> **Report** tab: six large icon tiles under "What is happening?". Pick *Elephant near village*.

**Flow 2 - Report details (screenshot 2).** The details screen shows the location from GPS ("Detected from GPS") with **Change** (opens the village list). Choose how many (1 / 2-5 / 6+), when (Now / Earlier today), optionally *Add photo* ("only if it is safe"), then *Send report*. To show the fallback, deny the location permission (or tap *Change*): the village list is used and reporting is never blocked. Choose *Person injured* to show the prominent "Call 1990 first" banner with a call button.

**Flow 3 - Honest confirmation (screenshot 3).** After sending: "Report received", the reference (e.g. `C-0153`) and the Received -> Being checked -> Outcome tracker with only *Received* ticked, plus "An officer will check this report." Nothing claims anyone was dispatched. Open **My Reports** to see it as *Received*; on the officer's Map tab the report is a grey *Unverified* marker. Offline variant: switch the phone to airplane mode and send: "Saved safely - we'll retry automatically", then reconnect and watch it appear in My Reports without resending.

**Flow 4 - SMS (screenshot 4).** Welcome or Sign-in screen -> *SMS simulator (demo)* (visible only when `EXPO_PUBLIC_DEMO_MODE=true`; not a tab). Tap the *Valid* example `ALIYA PALATUPANA` -> *Send SMS*: acknowledgement with a tracking code ("Report C-0153 received. An officer will check it. Stay away from the elephant."). Tap *Invalid* (`HELLO`): no report is created and the format help with an example is shown in English, Sinhala and Tamil. *Unknown place* (`ALIYA NOWHEREVILLE`) shows the place-not-recognised help (a registered sender instead gets a call-back-flagged report). Equivalent API call:
```bash
curl -X POST http://localhost:5000/api/v1/sms/simulate -H "Content-Type: application/json" \
  -d '{"phone":"0701112233","message":"ALIYA PALATUPANA"}'
```

**Flow 5 - Verification queue (screenshot 5).** Sign the villager out (**Safety** tab -> *Sign out*; or use a second device/emulator) and sign in as the officer -> **Queue**: *Person injured* (URGENT) first, the elephant reports **grouped** with a "N REPORTS" count, a *CALL BACK* item where the place was not recognised, and the Pending / Urgent / Verified counters. To create fresh duplicates: send `ALIYA PALATUPANA` twice from the SMS simulator, or report the same type from two villagers within 1 km / 2 hours. Sign in as `officer.fernando` to show that officers only see their own divisions.

**Flow 6 - Verify and notify (screenshot 6).** Open the grouped elephant report: map and caption, reporter, "Nearby collar data - EL-07 detected about 380 m from this location", the verification method selector. Choose a method -> *Verify* -> add notes -> switch on **Field action needed** ("Notify Sector 3 rangers", the marker preview turns orange) -> *Save and notify team*. Then show: the **Map** tab (orange *Action* marker with the group count), **History** (audit entry), the villager's **My Reports** (status *Verified* and "Field action has been requested"), and the notification record (`notifications` table, `FIELD_ACTION`, plus the `SIMULATED PUSH` line in the backend log). Show *Reject*: the reject button needs a reason; the marker disappears from the map and the report stays in History.

Concurrency demo: open the same pending report on two officer sessions (`officer.perera` and another officer assigned to the same division), verify on one, then try on the other: "Another officer has already reviewed this report" with the first officer's name.

## Coverage screenshot for the report

```bash
cd backend && npm run test:coverage     # coverage summary in the terminal, HTML in backend/coverage/
cd mobile  && npm run test:coverage     # HTML in mobile/coverage/
```

## Troubleshooting

- *Sign in fails with "not connected to the server yet"*: fill `mobile/.env` and restart `npx expo start -c`.
- *Network errors on a phone*: `EXPO_PUBLIC_API_URL` must use the PC's LAN IP; phone and PC on the same network; allow port 5000 in the firewall.
- *Registration/login rejected with an email error*: set a deliverable-looking `PHONE_LOGIN_EMAIL_DOMAIN` (the same value in backend and mobile) and make sure "Confirm email" is off.
- *Map is blank in a development build*: set `GOOGLE_MAPS_API_KEY` for Android builds (Expo Go works without it).
