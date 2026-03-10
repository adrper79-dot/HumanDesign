/**
 * Energy Blueprint Structural Data — Phase 5
 *
 * Embeds centers, channels, gate-wheel, and incarnation-cross data
 * from src/data/*.json for frontend enrichment.
 *
 * Provides lookup helpers: getCenterInfo(), getChannelMeta(),
 * getGateHex(), getCrossName(), getGateCenter(), isMotorCenter().
 */

/* ── Centers ── */
window.HD_CENTERS = {
  Head:         { gates: [61,63,64],                  bio: "Pineal gland — mental pressure, inspiration",                      fn: "Pressure to think, to be inspired, to answer questions",                            motor: false },
  Ajna:         { gates: [4,11,17,24,43,47],          bio: "Anterior and posterior pituitary — conceptualization",              fn: "Processing, conceptualizing, forming opinions and theories",                        motor: false },
  Throat:       { gates: [8,12,16,20,23,31,33,35,45,56,62], bio: "Thyroid and parathyroid — expression, manifestation",        fn: "Communication, expression, manifestation into form, action",                        motor: false },
  G:            { gates: [1,2,7,10,13,15,25,46],      bio: "Liver, blood — identity, direction, love",                         fn: "Identity, direction in life, love, self-expression",                                motor: false },
  Heart:        { gates: [21,26,40,51],                bio: "Heart, gallbladder, stomach, thymus — willpower",                  fn: "Willpower, ego, material world, self-worth, courage",                               motor: true },
  SolarPlexus:  { gates: [6,22,30,36,37,49,55],       bio: "Kidneys, prostate, pancreas, nervous system — emotions",           fn: "Emotions, feelings, desire, sensitivity, emotional wave",                           motor: true },
  Sacral:       { gates: [3,5,9,14,27,29,34,42,59],   bio: "Ovaries, testes — life force, fertility, sexuality",               fn: "Life force energy, work capacity, fertility, response, availability",               motor: true },
  Spleen:       { gates: [18,28,32,44,48,50,57],      bio: "Lymphatic system, spleen, T-cells — immune system, intuition",     fn: "Survival, health, intuition, time, fear, instinct, taste and values",               motor: false },
  Root:         { gates: [19,38,39,41,52,53,54,58,60], bio: "Adrenal glands — stress, adrenaline, pressure",                   fn: "Pressure to evolve, stress management, drive, fuel for ambition",                   motor: true }
};

/* ── Gate → Center reverse lookup ── */
window.HD_GATE_TO_CENTER = {};
(function() {
  for (const [c, info] of Object.entries(window.HD_CENTERS)) {
    for (const g of info.gates) window.HD_GATE_TO_CENTER[g] = c;
  }
})();

/* ── Channels ── */
window.HD_CHANNELS_META = [
  { key:"1-8",   gates:[1,8],   centers:["G","Throat"],             circuit:"Individual",            name:"Inspiration" },
  { key:"2-14",  gates:[2,14],  centers:["G","Sacral"],             circuit:"Individual",            name:"The Beat" },
  { key:"3-60",  gates:[3,60],  centers:["Sacral","Root"],          circuit:"Individual",            name:"Mutation" },
  { key:"4-63",  gates:[4,63],  centers:["Ajna","Head"],            circuit:"Collective (Logic)",    name:"Logic" },
  { key:"5-15",  gates:[5,15],  centers:["Sacral","G"],             circuit:"Collective (Logic)",    name:"Rhythms" },
  { key:"6-59",  gates:[6,59],  centers:["SolarPlexus","Sacral"],   circuit:"Tribal (Defense)",      name:"Intimacy" },
  { key:"7-31",  gates:[7,31],  centers:["G","Throat"],             circuit:"Collective (Logic)",    name:"The Alpha" },
  { key:"9-52",  gates:[9,52],  centers:["Sacral","Root"],          circuit:"Collective (Logic)",    name:"Concentration" },
  { key:"10-20", gates:[10,20], centers:["G","Throat"],             circuit:"Integration",           name:"Awakening" },
  { key:"10-34", gates:[10,34], centers:["G","Sacral"],             circuit:"Integration",           name:"Exploration" },
  { key:"10-57", gates:[10,57], centers:["G","Spleen"],             circuit:"Integration",           name:"Perfected Form" },
  { key:"11-56", gates:[11,56], centers:["Ajna","Throat"],          circuit:"Collective (Abstract)", name:"Curiosity" },
  { key:"12-22", gates:[12,22], centers:["Throat","SolarPlexus"],   circuit:"Individual",            name:"Openness" },
  { key:"13-33", gates:[13,33], centers:["G","Throat"],             circuit:"Collective (Abstract)", name:"The Prodigal" },
  { key:"16-48", gates:[16,48], centers:["Throat","Spleen"],        circuit:"Collective (Logic)",    name:"The Wavelength" },
  { key:"17-62", gates:[17,62], centers:["Ajna","Throat"],          circuit:"Collective (Logic)",    name:"Acceptance" },
  { key:"18-58", gates:[18,58], centers:["Spleen","Root"],          circuit:"Collective (Logic)",    name:"Judgment" },
  { key:"19-49", gates:[19,49], centers:["Root","SolarPlexus"],     circuit:"Tribal (Ego)",          name:"Synthesis" },
  { key:"20-34", gates:[20,34], centers:["Throat","Sacral"],        circuit:"Integration",           name:"Charisma" },
  { key:"20-57", gates:[20,57], centers:["Throat","Spleen"],        circuit:"Integration",           name:"The Brainwave" },
  { key:"21-45", gates:[21,45], centers:["Heart","Throat"],         circuit:"Tribal (Ego)",          name:"The Money Line" },
  { key:"23-43", gates:[23,43], centers:["Throat","Ajna"],          circuit:"Individual",            name:"Structuring" },
  { key:"24-61", gates:[24,61], centers:["Ajna","Head"],            circuit:"Individual",            name:"Awareness" },
  { key:"25-51", gates:[25,51], centers:["G","Heart"],              circuit:"Individual",            name:"Initiation" },
  { key:"26-44", gates:[26,44], centers:["Heart","Spleen"],         circuit:"Tribal (Ego)",          name:"Surrender" },
  { key:"27-50", gates:[27,50], centers:["Sacral","Spleen"],        circuit:"Tribal (Defense)",      name:"Preservation" },
  { key:"28-38", gates:[28,38], centers:["Spleen","Root"],          circuit:"Individual",            name:"Struggle" },
  { key:"29-46", gates:[29,46], centers:["Sacral","G"],             circuit:"Collective (Abstract)", name:"Discovery" },
  { key:"30-41", gates:[30,41], centers:["SolarPlexus","Root"],     circuit:"Collective (Abstract)", name:"Recognition" },
  { key:"32-54", gates:[32,54], centers:["Spleen","Root"],          circuit:"Tribal (Ego)",          name:"Transformation" },
  { key:"34-57", gates:[34,57], centers:["Sacral","Spleen"],        circuit:"Integration",           name:"Power" },
  { key:"35-36", gates:[35,36], centers:["Throat","SolarPlexus"],   circuit:"Collective (Abstract)", name:"Transitoriness" },
  { key:"37-40", gates:[37,40], centers:["SolarPlexus","Heart"],    circuit:"Tribal (Ego)",          name:"Community" },
  { key:"39-55", gates:[39,55], centers:["Root","SolarPlexus"],     circuit:"Individual",            name:"Emoting" },
  { key:"42-53", gates:[42,53], centers:["Sacral","Root"],          circuit:"Collective (Abstract)", name:"Maturation" },
  { key:"47-64", gates:[47,64], centers:["Ajna","Head"],            circuit:"Collective (Abstract)", name:"Abstraction" }
];

/* ── Channel key → meta lookup ── */
window.HD_CHANNEL_MAP = {};
(function() {
  for (const ch of window.HD_CHANNELS_META) window.HD_CHANNEL_MAP[ch.key] = ch;
})();

/* ── Gate Wheel — I Ching hexagram names ── */
window.HD_HEX_NAMES = {
  17:"Following",21:"Biting Through",51:"The Arousing",42:"Increase",3:"Difficulty at the Beginning",
  27:"Nourishment",24:"Return",2:"The Receptive",23:"Splitting Apart",8:"Holding Together",
  20:"Contemplation",16:"Enthusiasm",35:"Progress",45:"Gathering Together",12:"Standstill",
  15:"Modesty",52:"Keeping Still",39:"Obstruction",53:"Development",62:"Preponderance of the Small",
  56:"The Wanderer",31:"Influence",33:"Retreat",7:"The Army",4:"Youthful Folly",
  29:"The Abysmal",59:"Dispersion",40:"Deliverance",64:"Before Completion",47:"Oppression",
  6:"Conflict",46:"Pushing Upward",18:"Work on the Decayed",48:"The Well",57:"The Gentle",
  32:"Duration",50:"The Caldron",28:"Preponderance of the Great",44:"Coming to Meet",1:"The Creative",
  43:"Breakthrough",14:"Possession in Great Measure",34:"The Power of the Great",9:"The Taming Power of the Small",
  5:"Waiting",26:"The Taming Power of the Great",11:"Peace",10:"Treading",58:"The Joyous",
  38:"Opposition",54:"The Marrying Maiden",61:"Inner Truth",60:"Limitation",41:"Decrease",
  19:"Approach",13:"Fellowship with Men",49:"Revolution",30:"The Clinging",55:"Abundance",
  37:"The Family",63:"After Completion",22:"Grace",36:"Darkening of the Light",25:"Innocence"
};

/* ── Soul Crosses (192 variants) ── */
window.HD_CROSSES = {"1":{"right":{"name":"Right Angle Cross of the Sphinx","gates":[1,2,7,13]},"juxta":{"name":"Juxtaposition Cross of Self-Expression","gates":[1,2,7,13]},"left":{"name":"Left Angle Cross of Defiance","gates":[1,2,7,13]}},"2":{"right":{"name":"Right Angle Cross of the Sphinx","gates":[2,1,13,7]},"juxta":{"name":"Juxtaposition Cross of the Driver","gates":[2,1,13,7]},"left":{"name":"Left Angle Cross of Defiance","gates":[2,1,13,7]}},"3":{"right":{"name":"Right Angle Cross of Laws","gates":[3,50,41,31]},"juxta":{"name":"Juxtaposition Cross of Mutation","gates":[3,50,41,31]},"left":{"name":"Left Angle Cross of Wishes","gates":[3,50,41,31]}},"4":{"right":{"name":"Right Angle Cross of Explanation","gates":[4,49,8,14]},"juxta":{"name":"Juxtaposition Cross of Formulization","gates":[4,49,8,14]},"left":{"name":"Left Angle Cross of Revolution","gates":[4,49,8,14]}},"5":{"right":{"name":"Right Angle Cross of Consciousness","gates":[5,35,63,64]},"juxta":{"name":"Juxtaposition Cross of Habits","gates":[5,35,63,64]},"left":{"name":"Left Angle Cross of Separation","gates":[5,35,63,64]}},"6":{"right":{"name":"Right Angle Cross of Eden","gates":[6,36,12,11]},"juxta":{"name":"Juxtaposition Cross of Conflict","gates":[6,36,12,11]},"left":{"name":"Left Angle Cross of the Plane","gates":[6,36,12,11]}},"7":{"right":{"name":"Right Angle Cross of the Sphinx","gates":[7,13,1,2]},"juxta":{"name":"Juxtaposition Cross of Interaction","gates":[7,13,1,2]},"left":{"name":"Left Angle Cross of the Masks","gates":[7,13,1,2]}},"8":{"right":{"name":"Right Angle Cross of Contagion","gates":[8,14,55,59]},"juxta":{"name":"Juxtaposition Cross of Contribution","gates":[8,14,55,59]},"left":{"name":"Left Angle Cross of Uncertainty","gates":[8,14,55,59]}},"9":{"right":{"name":"Right Angle Cross of Planning","gates":[9,16,40,37]},"juxta":{"name":"Juxtaposition Cross of Focus","gates":[9,16,40,37]},"left":{"name":"Left Angle Cross of Determination","gates":[9,16,40,37]}},"10":{"right":{"name":"Right Angle Cross of the Vessel of Love","gates":[10,15,46,25]},"juxta":{"name":"Juxtaposition Cross of Behavior","gates":[10,15,46,25]},"left":{"name":"Left Angle Cross of Prevention","gates":[10,15,46,25]}},"11":{"right":{"name":"Right Angle Cross of Eden","gates":[11,12,36,6]},"juxta":{"name":"Juxtaposition Cross of Ideas","gates":[11,12,36,6]},"left":{"name":"Left Angle Cross of Education","gates":[11,12,36,6]}},"12":{"right":{"name":"Right Angle Cross of Eden","gates":[12,11,6,36]},"juxta":{"name":"Juxtaposition Cross of Articulation","gates":[12,11,6,36]},"left":{"name":"Left Angle Cross of Education","gates":[12,11,6,36]}},"13":{"right":{"name":"Right Angle Cross of the Sphinx","gates":[13,7,2,1]},"juxta":{"name":"Juxtaposition Cross of Listening","gates":[13,7,2,1]},"left":{"name":"Left Angle Cross of the Masks","gates":[13,7,2,1]}},"14":{"right":{"name":"Right Angle Cross of Contagion","gates":[14,8,59,55]},"juxta":{"name":"Juxtaposition Cross of Empowering","gates":[14,8,59,55]},"left":{"name":"Left Angle Cross of Uncertainty","gates":[14,8,59,55]}},"15":{"right":{"name":"Right Angle Cross of the Vessel of Love","gates":[15,10,25,46]},"juxta":{"name":"Juxtaposition Cross of Extremes","gates":[15,10,25,46]},"left":{"name":"Left Angle Cross of Prevention","gates":[15,10,25,46]}},"16":{"right":{"name":"Right Angle Cross of Planning","gates":[16,9,37,40]},"juxta":{"name":"Juxtaposition Cross of Experimentation","gates":[16,9,37,40]},"left":{"name":"Left Angle Cross of Identification","gates":[16,9,37,40]}},"17":{"right":{"name":"Right Angle Cross of Service","gates":[17,18,58,52]},"juxta":{"name":"Juxtaposition Cross of Opinions","gates":[17,18,58,52]},"left":{"name":"Left Angle Cross of Industry","gates":[17,18,58,52]}},"18":{"right":{"name":"Right Angle Cross of Service","gates":[18,17,52,58]},"juxta":{"name":"Juxtaposition Cross of Correction","gates":[18,17,52,58]},"left":{"name":"Left Angle Cross of Upheaval","gates":[18,17,52,58]}},"19":{"right":{"name":"Right Angle Cross of the Four Ways","gates":[19,33,44,24]},"juxta":{"name":"Juxtaposition Cross of Need","gates":[19,33,44,24]},"left":{"name":"Left Angle Cross of Refinement","gates":[19,33,44,24]}},"20":{"right":{"name":"Right Angle Cross of the Sleeping Phoenix","gates":[20,34,55,59]},"juxta":{"name":"Juxtaposition Cross of the Now","gates":[20,34,55,59]},"left":{"name":"Left Angle Cross of Duality","gates":[20,34,55,59]}},"21":{"right":{"name":"Right Angle Cross of Tension","gates":[21,48,38,39]},"juxta":{"name":"Juxtaposition Cross of Control","gates":[21,48,38,39]},"left":{"name":"Left Angle Cross of Endeavor","gates":[21,48,38,39]}},"22":{"right":{"name":"Right Angle Cross of Rulership","gates":[22,47,12,11]},"juxta":{"name":"Juxtaposition Cross of Grace","gates":[22,47,12,11]},"left":{"name":"Left Angle Cross of Informing","gates":[22,47,12,11]}},"23":{"right":{"name":"Right Angle Cross of Explanation","gates":[23,43,49,4]},"juxta":{"name":"Juxtaposition Cross of Assimilation","gates":[23,43,49,4]},"left":{"name":"Left Angle Cross of Dedication","gates":[23,43,49,4]}},"24":{"right":{"name":"Right Angle Cross of the Four Ways","gates":[24,44,33,19]},"juxta":{"name":"Juxtaposition Cross of Rationalization","gates":[24,44,33,19]},"left":{"name":"Left Angle Cross of Incarnation","gates":[24,44,33,19]}},"25":{"right":{"name":"Right Angle Cross of the Vessel of Love","gates":[25,46,10,15]},"juxta":{"name":"Juxtaposition Cross of Innocence","gates":[25,46,10,15]},"left":{"name":"Left Angle Cross of the Spirit","gates":[25,46,10,15]}},"26":{"right":{"name":"Right Angle Cross of Rulership","gates":[26,45,6,36]},"juxta":{"name":"Juxtaposition Cross of the Trickster","gates":[26,45,6,36]},"left":{"name":"Left Angle Cross of Confrontation","gates":[26,45,6,36]}},"27":{"right":{"name":"Right Angle Cross of the Unexpected","gates":[27,28,41,31]},"juxta":{"name":"Juxtaposition Cross of Caring","gates":[27,28,41,31]},"left":{"name":"Left Angle Cross of Alignment","gates":[27,28,41,31]}},"28":{"right":{"name":"Right Angle Cross of the Unexpected","gates":[28,27,31,41]},"juxta":{"name":"Juxtaposition Cross of Risks","gates":[28,27,31,41]},"left":{"name":"Left Angle Cross of Alignment","gates":[28,27,31,41]}},"29":{"right":{"name":"Right Angle Cross of Contagion","gates":[29,30,20,34]},"juxta":{"name":"Juxtaposition Cross of Commitment","gates":[29,30,20,34]},"left":{"name":"Left Angle Cross of Industry","gates":[29,30,20,34]}},"30":{"right":{"name":"Right Angle Cross of Contagion","gates":[30,29,34,20]},"juxta":{"name":"Juxtaposition Cross of Fates","gates":[30,29,34,20]},"left":{"name":"Left Angle Cross of Industry","gates":[30,29,34,20]}},"31":{"right":{"name":"Right Angle Cross of the Unexpected","gates":[31,41,27,28]},"juxta":{"name":"Juxtaposition Cross of Influence","gates":[31,41,27,28]},"left":{"name":"Left Angle Cross of the Alpha","gates":[31,41,27,28]}},"32":{"right":{"name":"Right Angle Cross of Maya","gates":[32,42,56,60]},"juxta":{"name":"Juxtaposition Cross of Conservation","gates":[32,42,56,60]},"left":{"name":"Left Angle Cross of Limitation","gates":[32,42,56,60]}},"33":{"right":{"name":"Right Angle Cross of the Four Ways","gates":[33,19,24,44]},"juxta":{"name":"Juxtaposition Cross of Retreat","gates":[33,19,24,44]},"left":{"name":"Left Angle Cross of Refinement","gates":[33,19,24,44]}},"34":{"right":{"name":"Right Angle Cross of the Sleeping Phoenix","gates":[34,20,59,55]},"juxta":{"name":"Juxtaposition Cross of Power","gates":[34,20,59,55]},"left":{"name":"Left Angle Cross of Duality","gates":[34,20,59,55]}},"35":{"right":{"name":"Right Angle Cross of Consciousness","gates":[35,5,64,63]},"juxta":{"name":"Juxtaposition Cross of Experience","gates":[35,5,64,63]},"left":{"name":"Left Angle Cross of Separation","gates":[35,5,64,63]}},"36":{"right":{"name":"Right Angle Cross of Eden","gates":[36,6,11,12]},"juxta":{"name":"Juxtaposition Cross of Crisis","gates":[36,6,11,12]},"left":{"name":"Left Angle Cross of the Plane","gates":[36,6,11,12]}},"37":{"right":{"name":"Right Angle Cross of Planning","gates":[37,40,9,16]},"juxta":{"name":"Juxtaposition Cross of Bargains","gates":[37,40,9,16]},"left":{"name":"Left Angle Cross of Migration","gates":[37,40,9,16]}},"38":{"right":{"name":"Right Angle Cross of Tension","gates":[38,39,48,21]},"juxta":{"name":"Juxtaposition Cross of Opposition","gates":[38,39,48,21]},"left":{"name":"Left Angle Cross of Individualism","gates":[38,39,48,21]}},"39":{"right":{"name":"Right Angle Cross of Tension","gates":[39,38,21,48]},"juxta":{"name":"Juxtaposition Cross of Provocation","gates":[39,38,21,48]},"left":{"name":"Left Angle Cross of Individualism","gates":[39,38,21,48]}},"40":{"right":{"name":"Right Angle Cross of Planning","gates":[40,37,16,9]},"juxta":{"name":"Juxtaposition Cross of Denial","gates":[40,37,16,9]},"left":{"name":"Left Angle Cross of Migration","gates":[40,37,16,9]}},"41":{"right":{"name":"Right Angle Cross of the Unexpected","gates":[41,31,28,27]},"juxta":{"name":"Juxtaposition Cross of Fantasy","gates":[41,31,28,27]},"left":{"name":"Left Angle Cross of the Alpha","gates":[41,31,28,27]}},"42":{"right":{"name":"Right Angle Cross of Maya","gates":[42,32,60,56]},"juxta":{"name":"Juxtaposition Cross of Completion","gates":[42,32,60,56]},"left":{"name":"Left Angle Cross of Limitation","gates":[42,32,60,56]}},"43":{"right":{"name":"Right Angle Cross of Explanation","gates":[43,23,4,49]},"juxta":{"name":"Juxtaposition Cross of Insight","gates":[43,23,4,49]},"left":{"name":"Left Angle Cross of Dedication","gates":[43,23,4,49]}},"44":{"right":{"name":"Right Angle Cross of the Four Ways","gates":[44,24,19,33]},"juxta":{"name":"Juxtaposition Cross of Alertness","gates":[44,24,19,33]},"left":{"name":"Left Angle Cross of Incarnation","gates":[44,24,19,33]}},"45":{"right":{"name":"Right Angle Cross of Rulership","gates":[45,26,36,6]},"juxta":{"name":"Juxtaposition Cross of Possession","gates":[45,26,36,6]},"left":{"name":"Left Angle Cross of Confrontation","gates":[45,26,36,6]}},"46":{"right":{"name":"Right Angle Cross of the Vessel of Love","gates":[46,25,15,10]},"juxta":{"name":"Juxtaposition Cross of Serendipity","gates":[46,25,15,10]},"left":{"name":"Left Angle Cross of the Spirit","gates":[46,25,15,10]}},"47":{"right":{"name":"Right Angle Cross of Rulership","gates":[47,22,11,12]},"juxta":{"name":"Juxtaposition Cross of Oppression","gates":[47,22,11,12]},"left":{"name":"Left Angle Cross of Informing","gates":[47,22,11,12]}},"48":{"right":{"name":"Right Angle Cross of Tension","gates":[48,21,39,38]},"juxta":{"name":"Juxtaposition Cross of Depth","gates":[48,21,39,38]},"left":{"name":"Left Angle Cross of Endeavor","gates":[48,21,39,38]}},"49":{"right":{"name":"Right Angle Cross of Explanation","gates":[49,4,14,8]},"juxta":{"name":"Juxtaposition Cross of Principles","gates":[49,4,14,8]},"left":{"name":"Left Angle Cross of Revolution","gates":[49,4,14,8]}},"50":{"right":{"name":"Right Angle Cross of Laws","gates":[50,3,31,41]},"juxta":{"name":"Juxtaposition Cross of Values","gates":[50,3,31,41]},"left":{"name":"Left Angle Cross of Wishes","gates":[50,3,31,41]}},"51":{"right":{"name":"Right Angle Cross of Penetration","gates":[51,57,61,62]},"juxta":{"name":"Juxtaposition Cross of Shock","gates":[51,57,61,62]},"left":{"name":"Left Angle Cross of the Clarion","gates":[51,57,61,62]}},"52":{"right":{"name":"Right Angle Cross of Service","gates":[52,58,17,18]},"juxta":{"name":"Juxtaposition Cross of Stillness","gates":[52,58,17,18]},"left":{"name":"Left Angle Cross of Demands","gates":[52,58,17,18]}},"53":{"right":{"name":"Right Angle Cross of Penetration","gates":[53,54,42,32]},"juxta":{"name":"Juxtaposition Cross of Beginnings","gates":[53,54,42,32]},"left":{"name":"Left Angle Cross of Cycles","gates":[53,54,42,32]}},"54":{"right":{"name":"Right Angle Cross of Penetration","gates":[54,53,32,42]},"juxta":{"name":"Juxtaposition Cross of Ambition","gates":[54,53,32,42]},"left":{"name":"Left Angle Cross of Cycles","gates":[54,53,32,42]}},"55":{"right":{"name":"Right Angle Cross of the Sleeping Phoenix","gates":[55,59,34,20]},"juxta":{"name":"Juxtaposition Cross of Moods","gates":[55,59,34,20]},"left":{"name":"Left Angle Cross of the Spirit","gates":[55,59,34,20]}},"56":{"right":{"name":"Right Angle Cross of Maya","gates":[56,60,32,42]},"juxta":{"name":"Juxtaposition Cross of Stimulation","gates":[56,60,32,42]},"left":{"name":"Left Angle Cross of Distraction","gates":[56,60,32,42]}},"57":{"right":{"name":"Right Angle Cross of Penetration","gates":[57,51,62,61]},"juxta":{"name":"Juxtaposition Cross of Intuition","gates":[57,51,62,61]},"left":{"name":"Left Angle Cross of the Clarion","gates":[57,51,62,61]}},"58":{"right":{"name":"Right Angle Cross of Service","gates":[58,52,18,17]},"juxta":{"name":"Juxtaposition Cross of Vitality","gates":[58,52,18,17]},"left":{"name":"Left Angle Cross of Demands","gates":[58,52,18,17]}},"59":{"right":{"name":"Right Angle Cross of the Sleeping Phoenix","gates":[59,55,20,34]},"juxta":{"name":"Juxtaposition Cross of Strategy","gates":[59,55,20,34]},"left":{"name":"Left Angle Cross of the Spirit","gates":[59,55,20,34]}},"60":{"right":{"name":"Right Angle Cross of Maya","gates":[60,56,42,32]},"juxta":{"name":"Juxtaposition Cross of Limitation","gates":[60,56,42,32]},"left":{"name":"Left Angle Cross of Distraction","gates":[60,56,42,32]}},"61":{"right":{"name":"Right Angle Cross of Penetration","gates":[61,62,51,57]},"juxta":{"name":"Juxtaposition Cross of Thinking","gates":[61,62,51,57]},"left":{"name":"Left Angle Cross of Obscuration","gates":[61,62,51,57]}},"62":{"right":{"name":"Right Angle Cross of Maya","gates":[62,61,57,51]},"juxta":{"name":"Juxtaposition Cross of Detail","gates":[62,61,57,51]},"left":{"name":"Left Angle Cross of Obscuration","gates":[62,61,57,51]}},"63":{"right":{"name":"Right Angle Cross of Consciousness","gates":[63,64,5,35]},"juxta":{"name":"Juxtaposition Cross of Doubts","gates":[63,64,5,35]},"left":{"name":"Left Angle Cross of Dominion","gates":[63,64,5,35]}},"64":{"right":{"name":"Right Angle Cross of Consciousness","gates":[64,63,35,5]},"juxta":{"name":"Juxtaposition Cross of Confusion","gates":[64,63,35,5]},"left":{"name":"Left Angle Cross of Dominion","gates":[64,63,35,5]}}};

/* ═════════════════ Lookup Helpers ═════════════════ */

/** Get center info (bio, fn, motor, gates) */
window.getCenterInfo = function(name) {
  return window.HD_CENTERS[name] || null;
};

/** Get I Ching hexagram name for a gate number */
window.getGateHex = function(num) {
  return window.HD_HEX_NAMES[num] || '';
};

/** Get channel metadata (circuit, centers, name) by key like "1-8" */
window.getChannelMeta = function(key) {
  return window.HD_CHANNEL_MAP[key] || null;
};

/** Get which center a gate belongs to */
window.getGateCenter = function(gateNum) {
  return window.HD_GATE_TO_CENTER[gateNum] || '';
};

/** Is this center a motor center? */
window.isMotorCenter = function(name) {
  const c = window.HD_CENTERS[name];
  return c ? c.motor : false;
};

/**
 * Get soul cross name.
 * @param {number} sunGate — Personality Sun gate number
 * @param {number} sunLine — Personality Sun line (1-6)
 * @returns {string} Cross name, or '' if unknown
 */
window.getCrossName = function(sunGate, sunLine) {
  const entry = window.HD_CROSSES[String(sunGate)];
  if (!entry) return '';
  if (sunLine <= 2) return entry.right ? entry.right.name : '';
  if (sunLine === 3) return entry.juxta ? entry.juxta.name : '';
  return entry.left ? entry.left.name : '';
};

/**
 * Get circuit badge label for a channel key
 * @param {string} key — e.g. "1-8"
 * @returns {string} Circuit label like "Individual" or "Tribal (Ego)"
 */
window.getChannelCircuit = function(key) {
  const ch = window.HD_CHANNEL_MAP[key];
  return ch ? ch.circuit : '';
};
