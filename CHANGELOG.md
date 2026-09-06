# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.1] - 2026-09-06

### Fixed

- Rate limiting block: entering `0` in the **Burst** field (a valid value per the input's own `min="0"`) was silently replaced with the default of `20` because the code used `parseInt(...) || 20`, which treats `0` as falsy. It's now parsed with an explicit `isNaN` check and clamped to the field's actual `min`/`max` range, so a burst of `0` (and any other in-range value) is honored. Applied the same fix to the **Rate** field for consistency.
- Theme toggle button: in light theme, the CSS only hid the sun icon (`[data-theme="light"] .icon-sun { display: none; }`) without ever un-hiding the moon icon (which carried an unconditional `.icon-moon { display: none; }`), so the toggle button rendered with no visible icon at all in light mode. Added the missing `[data-theme="light"] .icon-moon { display: block; }` rule so the moon icon now shows correctly in light theme.
