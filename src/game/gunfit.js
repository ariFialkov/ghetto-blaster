// How each generated gun model is fitted to the figures: real-world size and where the hands go.
//
// Measured on each model's side profile (scripts: none; read off gridded renders), in the model's own units before
// scaling: z runs from the butt to the muzzle (+Z = forward), y is up, the bore sits near y = 0.
//   hold   'rifle'   butt in the shoulder pocket, support hand under the handguard
//          'compact' no stock: held out in front of the chest with both hands (machine pistols, the Draco)
//          'pistol'  two-handed pistol grip
//   real   real-world overall length in metres (the model is scaled to it)
//   butt   [z, y] centre of the butt plate (rifles)
//   grip   [z, y] where the shooting hand's palm sits on the pistol grip (or the stock wrist on the pump gun)
//   fore   [zNear, zFar, yUnder] the stretch of handguard the support hand can hold, and its underside;
//          `vgrip` means a vertical foregrip, held by wrapping it instead of cupping underneath
//   mag    [z, y] magazine (or loading port / cylinder): where the support hand goes during a reload
//   sight  y of the sight line (iron sights or optic centre)
export const GUN_FIT = {
  // ---- primaries ----
  macdaddy: { hold: 'compact', real: 0.31, grip: [0.10, -0.09], fore: [0.24, 0.30, -0.04], mag: [0.11, -0.22], sight: 0.09 },
  tommy: { hold: 'rifle', real: 0.86, butt: [-0.24, -0.10], grip: [0.13, -0.12], fore: [0.62, 0.62, -0.13], vgrip: true, mag: [0.37, -0.12], sight: 0.14 },
  whisper: { hold: 'rifle', real: 0.80, butt: [-0.22, -0.08], grip: [0.10, -0.14], fore: [0.47, 0.58, -0.03], mag: [0.40, -0.18], sight: 0.12 },
  chopper: { hold: 'rifle', real: 0.88, butt: [-0.30, -0.09], grip: [0.13, -0.15], fore: [0.60, 0.84, -0.03], mag: [0.47, -0.22], sight: 0.14 },
  stick: { hold: 'rifle', real: 0.84, butt: [-0.26, -0.02], grip: [0.08, -0.15], fore: [0.53, 0.76, -0.03], mag: [0.33, -0.20], sight: 0.15 },
  drako: { hold: 'compact', real: 0.55, grip: [0.10, -0.12], fore: [0.42, 0.56, -0.05], mag: [0.33, -0.18], sight: 0.12 },
  trey: { hold: 'rifle', real: 0.92, butt: [-0.28, -0.04], grip: [0.13, -0.14], fore: [0.46, 0.80, -0.03], mag: [0.36, -0.20], sight: 0.21 },
  gauge: { hold: 'rifle', real: 1.00, butt: [-0.30, -0.12], grip: [0.14, -0.10], fore: [0.66, 0.96, -0.15], mag: [0.28, -0.10], sight: 0.08 },
  sweeper: { hold: 'rifle', real: 0.98, butt: [-0.29, -0.05], grip: [0.10, -0.15], fore: [0.55, 0.80, -0.05], mag: [0.40, -0.20], sight: 0.12 },
  fifty: { hold: 'rifle', real: 1.45, butt: [-0.34, -0.07], grip: [0.22, -0.13], fore: [0.48, 1.05, -0.05], mag: [0.48, -0.20], sight: 0.21 },
  cannon: { hold: 'rifle', real: 1.07, butt: [-0.32, -0.05], grip: [0.12, -0.13], fore: [0.55, 0.98, -0.04], mag: [0.40, -0.20], sight: 0.21 },
  ratchet: { hold: 'rifle', real: 1.04, butt: [-0.30, -0.03], grip: [0.10, -0.15], fore: [0.52, 0.60, -0.07], mag: [0.42, -0.22], sight: 0.13 },
  // ---- secondaries ----
  nine: { hold: 'pistol', real: 0.19, grip: [0.045, -0.07], mag: [0.035, -0.13], sight: 0.03 },
  fourfifth: { hold: 'pistol', real: 0.216, grip: [0.05, -0.07], mag: [0.04, -0.13], sight: 0.03 },
  deuce: { hold: 'pistol', real: 0.155, grip: [0.035, -0.055], mag: [0.03, -0.10], sight: 0.025 },
  hammer: { hold: 'pistol', real: 0.31, grip: [0.04, -0.075], mag: [0.10, -0.01], sight: 0.04 },
  snubby: { hold: 'pistol', real: 0.175, grip: [0.03, -0.06], mag: [0.09, 0.0], sight: 0.03 },
  switch: { hold: 'pistol', real: 0.20, grip: [0.04, -0.06], mag: [0.035, -0.13], sight: 0.03 },
  hush: { hold: 'pistol', real: 0.34, grip: [0.04, -0.06], mag: [0.035, -0.12], sight: 0.03 },
  blicky: { hold: 'pistol', real: 0.21, grip: [0.035, -0.055], mag: [0.03, -0.20], sight: 0.03 },
};

/** Fit data scaled to the gun as built: `s` is the scale applied to the model (real length / model length). */
export function scaledFit(id, s) {
  const f = GUN_FIT[id]; if (!f) return null;
  const k = (a) => (a ? a.map((v) => v * s) : null);
  return { hold: f.hold, scale: s, butt: k(f.butt), grip: k(f.grip), fore: k(f.fore), vgrip: !!f.vgrip, mag: k(f.mag), sight: f.sight * s, real: f.real };
}
