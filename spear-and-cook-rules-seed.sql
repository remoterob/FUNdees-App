-- ============================================================
-- SPEAR & COOK — seed the competition rules (from the 2025 event)
-- ============================================================
-- Run in Supabase → SQL Editor. Sets the rules text + version on the
-- "Spear & Cook 2026" competition. Text is verbatim from the previous
-- event, with the scoring URL updated to the new app location.

UPDATE sc_competitions
SET rules_version = '2025.11.27',
    rules_text = $rules$
Spear & Cook (Catch & Cook) — Safety Briefing

TEAM SAFETY
Pairs (or triples) competition only. Only one diver down at a time. Buddies must provide active safety.
All divers to stay within their limits, don't put yourself or your buddy at unnecessary risk.

Teams must stay within 25m of each other at all times.
No splitting up, no multiple floats, no "covering more ground."
Breaching this = instant team disqualification.

Each team must have a float boat with a dive flag, plus a flare or safety sausage.
→ Used to signal the safety boat for urgent assistance.

Non-urgent assistance: hold speargun upright.
Urgent assistance: wave your gun.

If any diver feels unwell, cold, unsafe, or stressed → stop diving immediately and communicate with your buddy.

Zero alcohol before or during the water-based part of the competition.

SPEARGUN SAFETY
Max two guns per team:
 • One on the main float line
 • One on a short line (<4m recommended). Short-line gun must be held when loaded — not dangling.
Guns must stay clipped on to lines at all times.
Identify your target and 10m beyond it before firing. If in doubt → do not shoot.
Never point a gun at anything you do not intend to shoot.
All guns must be unloaded in the starting triangle (at the boats). No fish may be shot in this zone.
Never load a gun on the boat or out of the water.

SWIM COMPETITION RULES
All boats travel to the zone together and anchor in the designated area (confirmed night before).
No competitor boats allowed in any other part of the zone during the spearfishing phase.
Comp will start as close to on or after 8am, as directed by the Competition Director.
Comp will end at 1pm sharp regardless of what time it started.
All teams start inside the triangle start zone and must return before the official end time.
Any team not checked in and back in the triangle by the cutoff receives 0 spearing points. No exceptions.
You must stay within the Competition zone.
Your finish time = when you re-enter the triangle AND notify officials, not when you leave the water.

DURING THE COMPETITION
Take breaks as needed. You may return to your boat anytime and re-enter the water (guns must be unloaded in the triangle/boat zone).
The competition window is long — stay hydrated, stay warm, and manage fatigue.
Keep fish shaded or on ice.

BURLEY AND MARINE ANIMALS
This is the Hauraki Gulf — expect sharks.
Absolutely no fish burley; use kina burley instead to reduce unwanted shark activity.
Float boats are mandatory, no towing fish around on the line.
Land fish cleanly and quickly. Store them securely in the float boat.
Do not gut/gill fish until the spearing portion is finished and everyone is out of the water.
If sharks are present and you're uncomfortable, move to another part of the zone.

WEIGH-IN & SCORING
Scoring is via the web app: https://spearfishingfundamentals.com/spear-and-cook.html
You may weigh your own fish if you have scales on the boat.
Scales are available on the Competition Director's (Anthony Hafoka) boat.
Teams must enter species, weight, and upload a verification photo.
The Competition Director may request to see fish — keep them whole until you return to shore. If any dispute is raised the Competition Director has final say on eligibility of uploaded fish and scoring.
Gut/gill fish only after the spearfishing portion is fully complete and everyone is safely out of the water.

BOATING & LOGISTICS
Two large launches depart Gulf Harbour for the competition zone. Boat allocations are in the app and have been shared. You must return on the boat you go out in.
All boats are to have a VHF radio and a first aid kit.
If bringing your own boat, be in the water off Gulf Harbour by 7:00am.
Respect your skipper — they are responsible for your safety on the boat.
Contribute to fuel, ice and operating costs as appropriate.
Coordinate gear (chilly bins, ice, dive bags) to avoid clutter.
Key boating / safety contacts:
 • Anthony Hafoka (Competition Director): 021 638 331
 • Lindsay (Safety Director): 021 664 109
 • Marine VHF channel 77 also monitored.
Competition Director may close the water portion early if conditions require. You may return earlier at his discretion.
Keep VHF channel 77 clear for competition-related comms.

AFTER THE SWIM COMPETITION
Skippers to notify Anthony Hafoka on Channel 77 or on 021 638 331 that all teams are on board before returning.
Assist skippers with pack-down and cleaning before heading to Cook Phase.
Use the time to organise your fish and prepare for the cooking section.

EMERGENCY PROCEDURES

Shallow water blackout:
 • Blow, Tap, Talk & buddy supports airway above water
 • Signal safety boat with flare/sausage or waved gun
 • Diver to stay out of the water for remainder of the competition
 • Oxygen available on safety boat if required

Loss of Motor Control (LMC / Samba):
 • Buddy supports airway above water
 • Signal safety boat with flare/sausage and waved gun
 • Diver to stay out of the water for remainder of the competition
 • Oxygen available on safety boat if required

Entanglement:
 • Drop weight belt immediately
 • Buddy to assist with freeing
 • If required, and can be done safely, use knife to free diver

First Aid / Injuries:
 • Ensure injured diver is supported on the surface.
 • Signal safety boat with flare/sausage and waved gun
 • The safety boat, Competition Director's boat and every boat that provides a ride have a first aid kit. Safety and Competition Directors can provide assistance if needed.

Emergency options:
 • Notify safety boat immediately using a flare and/or safety sausage.
 • Contact the Coast Guard on channel 16 (Coast Guard has access to an AED if ever needed).
 • Dial 111
$rules$
WHERE name = 'Spear & Cook 2026';
