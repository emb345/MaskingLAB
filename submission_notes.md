# Frequency masking experiment — submission notes

**Name:** [Your name]  
**Date measured:** [Date]  
**Playback:** [Headphones/speakers, device, and approximate system volume]  
**Masker level:** [Relative dBFS setting]  
**Browser:** [Browser and version]

## Objective and method — Method B: adaptive staircase

I measured the level at which a pure probe tone could be detected in a two-interval forced-choice task. In each masked trial, the masker played in both intervals and the probe was added to one interval chosen at random. I selected the interval that contained the probe. The app used a 2-down/1-up staircase, which estimates a detection point near 71% correct: two consecutive correct answers lowered the probe level, and one incorrect answer raised it. The step began at 6 dB and decreased to 2 dB after two reversals. The displayed threshold is the mean of the last six reversal levels from a run targeting eight reversals.

The same probe frequencies were measured without the masker to estimate a baseline. Masking amount is the masked threshold minus the unmasked threshold at the same probe frequency. All software levels are relative dBFS; playback was not calibrated to dB SPL.

During a run, the floating dashboard preview displays the staircase's current probe level as a provisional point at the selected probe frequency. It updates after each response. It is not the final threshold; the saved estimate is calculated from the reversal levels when the run ends.

## AI prediction before data collection

**Prompt:** “Before collecting data, predict the general shape of my tone-masking curves for 500, 1,000, 2,000, and 4,000 Hz maskers. Explain what to expect near and away from each masker, possible asymmetry, and how curve width may change with center frequency. Keep the prediction qualitative because my playback is not calibrated.”

**Response (prediction):** I expect the probe threshold to be highest close to each masker and to fall as probe frequency moves farther away. I predict a possible broader tail on the high-frequency side, but treat that as tentative: simultaneous tonal masking can depend on frequency ratio, level, and stimulus details. The frequency span of strong masking may widen in Hz at higher center frequencies, consistent with broader absolute auditory-filter bandwidths. These are broad predictions, not guaranteed outcomes; individual hearing, playback, and the staircase can shift the measured curves.

**How I will compare it:** I will compare the peak location, the slope on either side, and the frequency span of elevated thresholds across the four masker centers. I will judge masking amount only at probe frequencies with a matching no-mask baseline.

## Selected AI engineering prompts and responses

| Prompt | Response used in the app |
| --- | --- |
| “Design a practical, low-friction measurement method for a browser tone-masking experiment.” | Use two-interval forced choice: masker alone in one interval, masker plus a randomly placed probe in the other. Update probe level with a 2-down/1-up staircase and record reversal levels as the threshold estimate. |
| “How should I label levels if the browser output has not been acoustically calibrated?” | Label settings and thresholds as relative digital levels (dBFS), explain that they are not dB SPL, and tell the listener to keep playback comfortable. |
| “What should the dashboard show for comparing masked and unmasked detection?” | Plot threshold against logarithmic probe frequency, mark each masker center, and subtract a matching no-mask threshold to estimate masking amount. |

## AI suggestion corrected

**AI suggestion considered:** Label the masker and probe controls in **dB SPL** so the readings look like conventional sound-level measurements.

**Correction:** I rejected that suggestion because the browser has no sound-level calibration, and the actual level at the ear depends on the computer, output device, headphones, fit, and volume control. I changed the interface to **dBFS** and added a clear note that the values are only relative digital levels. This keeps the scale honest while preserving within-session comparisons.

## Results

Use **Export PDF** or **Export JPEG** to save a visual report containing the graph and saved measurements. Use that report to summarize your results below. Do not treat the initial AI prediction or a plotted expectation as personal data.

| Masker center | Masker level (dBFS) | Probe frequencies measured | Threshold range (dBFS) | Baselines collected? |
| ---: | ---: | --- | ---: | --- |
| 500 Hz | [ ] | [ ] | [ ] | [ ] |
| 1,000 Hz | [ ] | [ ] | [ ] | [ ] |
| 2,000 Hz | [ ] | [ ] | [ ] | [ ] |
| 4,000 Hz | [ ] | [ ] | [ ] | [ ] |

**Dashboard screenshot:** Capture the dashboard after collecting your curves and attach the image with the submission. The app deliberately starts with no invented measurements.

## Discussion

### Critical-band behavior

[Describe how quickly masking changed with frequency separation. Compare the width in Hz around each masker and whether the curves appear to broaden at higher center frequencies. Relate the pattern to auditory frequency selectivity and critical-band behavior.]

### Masking asymmetry

[For each masker, compare thresholds below and above the masker center. State whether masking spread farther upward, downward, or appeared approximately symmetric in your data. Refer to the baseline-subtracted chart where available.]

### Differences between masker frequencies

[Compare the 500, 1,000, 2,000, and 4,000 Hz conditions. Discuss peak height, curve width, and any irregular or unexpected points.]

### Prediction versus observation

[Say which parts of the AI prediction matched your curves and which did not. Give at least one specific frequency comparison from your data.]

### Limitations

The app does not measure dB SPL. Headphone frequency response, playback volume, room noise, listener attention, probe and masker interactions, and the limited number of staircase trials can all affect thresholds. The 2-down/1-up estimate targets roughly 71% correct rather than an absolute physiological threshold. Results are a personal demonstration, not a clinical hearing test.

## References for the prediction

- Goldsworthy, R. L., Delhorne, L. A., Braida, L. D., & Reed, C. M. (2013). *Psychoacoustic and Phoneme Identification Measures in Cochlear-Implant and Normal-Hearing Listeners*. Figure 4 plots probe detection thresholds under a 1,000-Hz tonal masker as a function of probe frequency. [Article](https://journals.sagepub.com/doi/10.1177/1084713813477244).
- Leschke, J., Rodriguez Orellana, G., Shera, C. A., & Oxenham, A. J. (2022). *Auditory filter shapes derived from forward and simultaneous masking at low frequencies: Implications for human cochlear tuning*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/35405591/).

## Deliverables checklist

- [ ] App runs in a browser and can play trials.
- [ ] Curves include at least three masker centers, with multiple probe frequencies around each.
- [ ] Matching baseline runs were measured where possible.
- [ ] Capture a dashboard screenshot after collecting measurements; do not treat the empty initial dashboard as results.
- [ ] PDF or JPEG report with the graph and measurements is included with the submission.
- [ ] Discussion and comparison with the AI prediction are completed.
