# Frequency Masking Lab

A standalone browser experiment for measuring personal tone-masking curves. The app synthesizes pure tones with Web Audio, runs two-interval forced-choice trials with an adaptive 2-down/1-up staircase, saves completed thresholds in the browser, and plots the results.

## Run it

Open `index.html` in a current browser, or serve this folder locally:

```bash
cd "frequency-masking-lab"
python3 -m http.server 8000
```

Open `http://localhost:8000`. The app needs no package install and sends no audio or measurement data to a server. Browser storage is local to the browser and device. Use **Export PDF** or **Export JPEG** in the Measurements section to save the graph and saved measurements as a visual report. PDF export opens the browser print dialog; choose **Save as PDF** there.

Use **Reset all data** to clear saved measurements and both charts, discard any active staircase, and restore the setup defaults. The app asks for confirmation first.

## Part 2 method: adaptive staircase (Method B)

The app uses a 2-down/1-up adaptive staircase. Two consecutive correct answers lower the probe level; an incorrect answer raises it. This targets about 71% correct, with 6 dB steps initially and 2 dB steps after two reversals. The threshold estimate averages the last six of eight reversal levels when the run reaches its target.

The response panel also offers **No difference** (or keyboard key `3`) when the listener cannot tell which interval contained the probe. This uncertainty response is scored as a miss, so the probe level steps up; its count is saved with each measurement and included in exported reports.

## Measure a curve

1. Choose a masker center (500, 1,000, 2,000, or 4,000 Hz), set a comfortable relative masker level, then choose a probe frequency.
2. Click **Begin threshold run**. Each trial has two intervals. Both include the masker; one also includes the probe. In baseline mode, one interval plays the probe and the other is intentionally silent, so only one audible tone is expected.
3. Click **Play both intervals**, then choose the interval that contained the probe. If you missed it, click **Replay same trial** to hear the identical pair again; replays do not advance the staircase or count as extra responses. If you couldn't tell, choose **No difference** or press `3`; interval choices use keys `1` and `2`.
4. The probe changes level automatically. The staircase uses two consecutive correct answers to lower the probe and one incorrect answer to raise it. It starts with 6 dB steps, changes to 2 dB steps after two reversals, and targets eight reversals (maximum 32 trials).
5. The saved threshold is the mean of the last six reversal levels, or all available levels if a run ends with four or five reversals. Runs with fewer than four reversals are not saved as thresholds.
6. Repeat for several probe frequencies around each masker. Measure a no-mask baseline at matching probe frequencies to use the **Masking amount** chart (masked threshold minus baseline threshold).

Probe choices are spaced around each masker center at approximate ratios of 0.5, 0.7, 0.85, 0.95, 1, 1.05, 1.2, 1.5, and 2, limited to 250–8,000 Hz. The precise values are shown in the selector.

## Level and listening notes

The interface reports relative digital levels in dBFS, not dB SPL. The playback chain is not calibrated, and device volume, headphones, fit, room noise, and hearing sensitivity vary. Keep the system volume low and use a comfortable listening level. The generated tones have short onset and offset ramps and a quiet digital output stage; that does not guarantee a known acoustic level at the ear.

## What the chart shows

- **Threshold** plots the estimated probe threshold for each masker center. A higher (less negative) value means a louder probe was needed.
- In **Threshold** view, horizontal dashed lines mark the masker dBFS level used for each curve; the exact level appears beside the masker name in the legend. The reference is hidden in **Masking amount** view because that axis shows a difference from baseline, not an absolute playback level.
- **Masking amount** subtracts the average unmasked baseline at the same probe frequency. It only appears where a matching baseline exists.
- Colored dashed vertical marks identify masker center frequencies. Repeated measurements at the same point are averaged for display, while individual runs remain in the saved table and exports.
- A small floating curve stays visible while scrolling and can be collapsed or reopened with its corner control. During a run, its highlighted point follows the staircase's current probe level after each response. This is provisional; the saved threshold uses reversal levels when the run ends.

## Report materials

Use [`submission_notes.md`](submission_notes.md) as a write-up scaffold. It includes an AI prediction made before data collection, selected engineering prompts and responses, the design correction, and fields for your own measurements and interpretation. The app starts with no synthetic or simulated user measurements; fill the report with data you collect.
