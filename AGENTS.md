# Writing rules for young players

Solbound is made for kids ages 7–12. Follow these rules whenever you change any text a player can see.

- Use plain English. Scientific names, units and sources may stay as they are, but explain a term the first time it matters (sol, radiation dose, millisievert, conjunction).
- Put the subject right before the verb. Do not add long phrases between them.
- One sentence explains one action, one reason or one result.
- Use short sentences. Avoid many clauses and long comma lists.
- Do not talk about machines, supplies or places as if they were people ("the solar panel is waiting for you").
- Buttons name the exact action and object. Avoid vague labels like "Find it" or "See the secret".
- Button names in tips must match the real buttons exactly.
- Show the problem first. Then explain the action. After the action, show the real result.
- The tutorial only moves on after the player does the current action. Closing a tip must never skip the real action.
- Keep the tutorial in cause-and-effect order: check power → go outside and repair → come back in, clean water and drink → share power → end the day.
- Keep the science data, conditions and resource costs. Simpler wording must never change a rule.
- When you change text, check the tutorial, tip cards, buttons, item cards, events, logs, intro and endings.
- Keep the resource gauges, power sharing and the 3D base view. Do not hide their entry points. Keep third-person control outside.
- Clicking the Console in the habitat opens the 3D base view directly: gauges on the left, environment on the right, the power card at the bottom center. The log only shows records.
- No emoji anywhere. Keep the cream, dark ink outline and yellow action button style. Icons use one SVG set or simple shapes.
- The habitat scene keeps its full-screen size and fixed position. Tutorials may float above it but must never resize or move it. The status bars must not cover object labels.
- Outside tasks name the place, the action and the result, for example "Scan the ground by the rocket", then explain scanning, saving and Science +6.
- The player-facing name is always "Console".
- The habitat, the 3D base view and the third-person trip outside share one "Outpost Status" panel and one set of game data. Oxygen, food, radiation, science, battery and shield must stay visible.
- The power tutorial shows the minimum power, the current amount and the finish button. "Finish Power Plan" in the tutorial uses the same logic as the button at the bottom.
- The tutorial only describes evidence the player can see. Before going outside, it only says power is low. Dust or a loose plug is named only after the player walks up and looks. Cleaning and repairs change the same part in the scene and update the power.
- "Go Outside" must be a real, eye-catching action button, never a switch or checkbox.
- In this version the habitat is a real-time 3D scene (js/cabin3d.js). All habitat layout rules above apply to it.
- Data honesty: never present stored data as live. Live NASA DONKI data, the dated DONKI snapshot and the curated archive must each be labelled as what they are.
