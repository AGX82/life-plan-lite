# Life Plan Lite Themes

## Black Glass Blue

CSS class: `theme-black-glass-blue`

Status: saved visual experiment.

Intent:

- Very dark base surfaces.
- Blue edge lighting and glossy panel reflections.
- Cooler blue-gray accent palette instead of green/teal.
- Deadline colors remain functional and are not part of the decorative theme palette.

Implementation:

- Theme tokens live in `src/renderer/src/styles/app.css`.
- The theme class is applied to the admin shell and display board root.
- Future themes can be added by defining another theme class with the same token names.

## Liquid Gunmetal

CSS class: `theme-liquid-gunmetal`

Status: saved active theme as of `v0.2.0`.

Intent:

- Dark gray, gunmetal, and crude-oil style background gradient.
- Softer translucent/frosted panels instead of shiny blue-black gloss.
- Liquid glass feel through blur, semi-transparent fills, rounded shapes, and subtle white edge highlights.
- Shared flatter background treatment with restrained panel gradients.
- Six-pixel structural corner radius.
- Themed scrollbars and in-app context menus.
- Deadline colors remain functional and are not part of the decorative theme palette.

## Midnight Clear

CSS class: `theme-midnight-clear`

Status: saved active theme as of `v0.3.0`.

Intent:

- Very dark blue-black background with reduced saturation and a colder overall tone.
- Near-transparent glass panels with just enough body to read as etched panes rather than outlines.
- Darker list title bands and slightly brighter column-header bands to separate structure from content.
- Cleaner admin editor presentation by removing the redundant middle wrapper shell.
- Improved board readability from a distance through slightly larger list-item text.
- Deadline colors remain functional and are not part of the decorative theme palette.
