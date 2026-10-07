# Homepage meal carousel

The welcome-page image rotates between lunch, breakfast and dinner every six
seconds, with a 550 ms crossfade. Visitors can choose a meal directly, use arrows
or arrow keys, and pause/resume rotation. Hovering or focusing the banner stops
automatic rotation until the Play control is used. Rotation also stops while the
page is hidden or the banner is outside the viewport. Reduced-motion preferences
disable autoplay and transitions; manual controls remain available.

The first image retains high loading priority. Other images are lazy loaded,
locally hosted WebP assets. Only loaded images can be selected; a failed image
is skipped. The banner has a fixed height so signup/search controls do not move.
No backend changes, paid services or new runtime dependencies are required.

## Image assets

- `public/images/shared-lunch.webp`: existing lunch image, retained.
- `public/images/shared-breakfast.webp`: new generated breakfast photograph,
  1152 × 768, approximately 124 KiB.
- `public/images/shared-dinner.webp`: new generated dinner photograph,
  1152 × 768, approximately 106 KiB.

New images were generated using the built-in image-generation tool, then
converted to WebP for the project. They illustrate meal occasions; they do not
represent a partner restaurant, a verified menu or currently available runs.

## Final generation prompts

### Breakfast

Use case: photorealistic-natural. Asset type: food photograph for Bitez Singapore community food-run website rotating hero banner. Generate ONE landscape photo, 3:2 aspect, of a casual Singapore breakfast shared on a warm cream stone cafe table: a plate with two golden flaky roti prata, a small bowl of rich vegetable curry with chickpeas and visible herbs, and two glasses of teh tarik. Close food-focused oblique overhead view, no people, believable crisp flaky texture with irregular edges, natural morning window light, warm beige and terracotta tones, relaxed editorial food photography. Food clustered centrally so it crops well into a tall square hero panel; bottom quarter can be cropped or overlaid by a website caption. No text, logos, restaurant branding, borders, watermarks, packaging labels, or artificial glossy plastic appearance. This is illustrative photography, not a named restaurant or menu.

### Dinner

Use case: photorealistic-natural. Asset type: food photograph for Bitez Singapore community food-run website rotating hero banner. Generate ONE landscape photo, 3:2 aspect, of an inviting Singapore evening meal on a warm cream stone hawker-style table: a ceramic plate of grilled chicken satay skewers with natural char, a small bowl of chunky peanut sauce, cucumber and red onion slices, compressed rice cakes, and a secondary plate of stir-fried vegetables. Close food-focused oblique overhead view, no people, warm natural late-afternoon light, believable food texture and modest casual plating, warm beige and terracotta palette, editorial photography. Food clustered centrally to crop well into a square-tall hero panel; bottom quarter can be cropped or overlaid by a website caption. No text, logos, branding, borders, watermarks, packaging, over-stylized plastic food, or fabricated restaurant offers.
