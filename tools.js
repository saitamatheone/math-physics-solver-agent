// tools.js — Tool implementations: calculate, convert, lookup

/**
 * TOOL: calculate
 * Safely evaluates a mathematical expression using Function constructor
 * Supports: basic arithmetic, powers, trig, sqrt, log, etc.
 */
function calculate(expression) {
  try {
    // Replace common math notation with JS equivalents
    let expr = expression
      .replace(/\^/g, '**')           // exponentiation
      .replace(/×/g, '*')             // multiplication symbol
      .replace(/÷/g, '/')             // division symbol
      .replace(/π/g, 'Math.PI')       // pi
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\be\b/g, 'Math.E')
      .replace(/\bsqrt\(/g, 'Math.sqrt(')
      .replace(/\bsin\(/g, 'Math.sin(')
      .replace(/\bcos\(/g, 'Math.cos(')
      .replace(/\btan\(/g, 'Math.tan(')
      .replace(/\blog\(/g, 'Math.log10(')
      .replace(/\bln\(/g, 'Math.log(')
      .replace(/\babs\(/g, 'Math.abs(')
      .replace(/\bceil\(/g, 'Math.ceil(')
      .replace(/\bfloor\(/g, 'Math.floor(');

    // Whitelist: only allow safe math characters
    if (/[^0-9+\-*/().%\s,Math.PIEsqrtsincotaglbfloecir]/.test(expr.replace(/Math\.\w+/g, ''))) {
      return { error: `Unsafe expression detected: ${expression}` };
    }

    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + expr + ')')();

    if (typeof result !== 'number' || isNaN(result)) {
      return { error: `Expression did not return a valid number: ${expression}` };
    }

    return { result: parseFloat(result.toPrecision(10)) };
  } catch (err) {
    return { error: `Calculation failed: ${err.message}` };
  }
}

/**
 * TOOL: convert
 * Converts between common unit pairs
 */
function convert(fromStr, toUnit) {
  // Parse value and unit from fromStr like "100 km" or "9.8 m/s^2"
  const match = fromStr.match(/^([\d.eE+\-]+)\s*(.+)$/);
  if (!match) return { error: `Cannot parse: "${fromStr}". Expected format: "value unit"` };

  const value = parseFloat(match[1]);
  const fromUnit = match[2].trim().toLowerCase();
  const to = toUnit.trim().toLowerCase();

  const conversions = {
    // Length
    "km->m": v => v * 1000,
    "m->km": v => v / 1000,
    "m->cm": v => v * 100,
    "cm->m": v => v / 100,
    "m->mm": v => v * 1000,
    "mm->m": v => v / 1000,
    "miles->km": v => v * 1.60934,
    "km->miles": v => v / 1.60934,
    "ft->m": v => v * 0.3048,
    "m->ft": v => v / 0.3048,
    "in->cm": v => v * 2.54,
    "cm->in": v => v / 2.54,
    "yards->m": v => v * 0.9144,
    "m->yards": v => v / 0.9144,

    // Mass
    "kg->g": v => v * 1000,
    "g->kg": v => v / 1000,
    "kg->lbs": v => v * 2.20462,
    "lbs->kg": v => v / 2.20462,
    "g->mg": v => v * 1000,
    "mg->g": v => v / 1000,
    "oz->g": v => v * 28.3495,
    "g->oz": v => v / 28.3495,

    // Time
    "s->ms": v => v * 1000,
    "ms->s": v => v / 1000,
    "min->s": v => v * 60,
    "s->min": v => v / 60,
    "h->s": v => v * 3600,
    "s->h": v => v / 3600,
    "h->min": v => v * 60,
    "min->h": v => v / 60,
    "days->h": v => v * 24,
    "h->days": v => v / 24,

    // Temperature
    "c->f": v => (v * 9/5) + 32,
    "f->c": v => (v - 32) * 5/9,
    "c->k": v => v + 273.15,
    "k->c": v => v - 273.15,
    "f->k": v => (v - 32) * 5/9 + 273.15,
    "k->f": v => (v - 273.15) * 9/5 + 32,

    // Speed
    "m/s->km/h": v => v * 3.6,
    "km/h->m/s": v => v / 3.6,
    "mph->km/h": v => v * 1.60934,
    "km/h->mph": v => v / 1.60934,
    "m/s->mph": v => v * 2.23694,
    "mph->m/s": v => v / 2.23694,

    // Energy
    "j->kj": v => v / 1000,
    "kj->j": v => v * 1000,
    "j->cal": v => v / 4.184,
    "cal->j": v => v * 4.184,
    "ev->j": v => v * 1.60218e-19,
    "j->ev": v => v / 1.60218e-19,

    // Pressure
    "pa->kpa": v => v / 1000,
    "kpa->pa": v => v * 1000,
    "atm->pa": v => v * 101325,
    "pa->atm": v => v / 101325,
    "bar->pa": v => v * 100000,
    "pa->bar": v => v / 100000,

    // Force
    "n->kn": v => v / 1000,
    "kn->n": v => v * 1000,
    "lbf->n": v => v * 4.44822,
    "n->lbf": v => v / 4.44822,

    // Angles
    "deg->rad": v => v * Math.PI / 180,
    "rad->deg": v => v * 180 / Math.PI,
  };

  const key = `${fromUnit}->${to}`;
  if (conversions[key]) {
    const result = conversions[key](value);
    return { result: parseFloat(result.toPrecision(8)), from: fromStr, to: toUnit };
  }

  return { error: `No conversion available from "${fromUnit}" to "${to}". Supported: ${Object.keys(conversions).join(', ')}` };
}

/**
 * TOOL: lookup
 * Returns well-known physical constants and formulas
 */
function lookup(fact) {
  const db = {
    // Physical Constants
    "speed of light": { value: "299,792,458 m/s", symbol: "c", notes: "Exact value in vacuum" },
    "gravitational constant": { value: "6.674 × 10⁻¹¹ N·m²/kg²", symbol: "G", notes: "Universal gravitational constant" },
    "gravity": { value: "9.8 m/s²", symbol: "g", notes: "Standard acceleration due to gravity on Earth's surface" },
    "planck constant": { value: "6.626 × 10⁻³⁴ J·s", symbol: "h", notes: "Fundamental quantum of action" },
    "boltzmann constant": { value: "1.381 × 10⁻²³ J/K", symbol: "k_B", notes: "Relates temperature to kinetic energy" },
    "avogadro number": { value: "6.022 × 10²³ mol⁻¹", symbol: "N_A", notes: "Number of entities per mole" },
    "electron charge": { value: "1.602 × 10⁻¹⁹ C", symbol: "e", notes: "Elementary charge" },
    "electron mass": { value: "9.109 × 10⁻³¹ kg", symbol: "m_e" },
    "proton mass": { value: "1.673 × 10⁻²⁷ kg", symbol: "m_p" },
    "neutron mass": { value: "1.675 × 10⁻²⁷ kg", symbol: "m_n" },
    "pi": { value: "3.14159265358979...", symbol: "π", notes: "Ratio of circle circumference to diameter" },
    "euler number": { value: "2.71828182845904...", symbol: "e", notes: "Base of natural logarithm" },
    "permittivity of free space": { value: "8.854 × 10⁻¹² F/m", symbol: "ε₀" },
    "permeability of free space": { value: "1.257 × 10⁻⁶ H/m", symbol: "μ₀" },
    "gas constant": { value: "8.314 J/(mol·K)", symbol: "R", notes: "Universal gas constant" },
    "stefan-boltzmann constant": { value: "5.670 × 10⁻⁸ W/(m²·K⁴)", symbol: "σ" },

    // Kinematics Formulas
    "kinematic equations": {
      formulas: [
        "v = v₀ + at",
        "s = v₀t + ½at²",
        "v² = v₀² + 2as",
        "s = ½(v₀ + v)t"
      ],
      notes: "Equations for constant acceleration"
    },
    "displacement": { formula: "s = v₀t + ½at²", notes: "Displacement under constant acceleration" },
    "velocity": { formula: "v = v₀ + at", notes: "Final velocity under constant acceleration" },
    "projectile motion": {
      formulas: [
        "x = v₀·cos(θ)·t",
        "y = v₀·sin(θ)·t - ½g·t²",
        "Range = v₀²·sin(2θ)/g",
        "Max height = v₀²·sin²(θ)/(2g)"
      ]
    },

    // Dynamics
    "newton's second law": { formula: "F = ma", notes: "Net force equals mass times acceleration" },
    "weight": { formula: "W = mg", notes: "Weight force on Earth" },
    "friction": { formula: "f = μN", notes: "Kinetic/static friction force" },
    "momentum": { formula: "p = mv", notes: "Linear momentum" },
    "impulse": { formula: "J = FΔt = Δp", notes: "Impulse equals change in momentum" },

    // Energy & Work
    "kinetic energy": { formula: "KE = ½mv²", notes: "Kinetic energy formula" },
    "potential energy": { formula: "PE = mgh", notes: "Gravitational potential energy" },
    "work": { formula: "W = F·d·cos(θ)", notes: "Work done by a force" },
    "power": { formula: "P = W/t = Fv", notes: "Rate of doing work" },
    "conservation of energy": { formula: "KE₁ + PE₁ = KE₂ + PE₂", notes: "Total mechanical energy is conserved (no friction)" },

    // Waves & Optics
    "wave speed": { formula: "v = fλ", notes: "Wave speed = frequency × wavelength" },
    "snell's law": { formula: "n₁·sin(θ₁) = n₂·sin(θ₂)", notes: "Refraction at interface" },
    "doppler effect": { formula: "f' = f(v ± v_observer)/(v ∓ v_source)", notes: "Observed frequency change due to motion" },

    // Electricity & Magnetism
    "ohm's law": { formula: "V = IR", notes: "Voltage = Current × Resistance" },
    "electric power": { formula: "P = IV = I²R = V²/R" },
    "coulomb's law": { formula: "F = kq₁q₂/r²", notes: "k = 8.99 × 10⁹ N·m²/C²" },
    "capacitance": { formula: "C = Q/V", notes: "Capacitance = Charge / Voltage" },
    "resistors in series": { formula: "R_total = R₁ + R₂ + ..." },
    "resistors in parallel": { formula: "1/R_total = 1/R₁ + 1/R₂ + ..." },

    // Thermodynamics
    "ideal gas law": { formula: "PV = nRT", notes: "P=pressure, V=volume, n=moles, R=8.314, T=temperature(K)" },
    "heat": { formula: "Q = mcΔT", notes: "Heat transfer; c = specific heat capacity" },
    "first law of thermodynamics": { formula: "ΔU = Q - W", notes: "Change in internal energy" },

    // Circular Motion & Gravity
    "centripetal acceleration": { formula: "a_c = v²/r = ω²r", notes: "Acceleration toward center of circle" },
    "centripetal force": { formula: "F_c = mv²/r", notes: "Net force required for circular motion" },
    "universal gravitation": { formula: "F = Gm₁m₂/r²", notes: "Gravitational force between two masses" },
    "orbital period": { formula: "T = 2π√(r³/GM)", notes: "Period of circular orbit" },

    // Math
    "quadratic formula": { formula: "x = (-b ± √(b²-4ac)) / 2a", notes: "Solves ax² + bx + c = 0" },
    "pythagorean theorem": { formula: "a² + b² = c²", notes: "Right triangle sides" },
    "area of circle": { formula: "A = πr²" },
    "circumference of circle": { formula: "C = 2πr" },
    "area of triangle": { formula: "A = ½ × base × height" },
    "volume of sphere": { formula: "V = (4/3)πr³" },
    "surface area of sphere": { formula: "A = 4πr²" },
    "volume of cylinder": { formula: "V = πr²h" },
    "law of cosines": { formula: "c² = a² + b² - 2ab·cos(C)" },
    "law of sines": { formula: "a/sin(A) = b/sin(B) = c/sin(C)" },
  };

  const key = fact.toLowerCase().trim();

  // Exact match
  if (db[key]) return { found: true, fact: key, ...db[key] };

  // Fuzzy match — find keys that include query words
  const words = key.split(/\s+/);
  const matches = Object.keys(db).filter(k => words.some(w => k.includes(w)));

  if (matches.length > 0) {
    const best = matches[0];
    return { found: true, fact: best, suggestion: `Matched "${best}" for query "${fact}"`, ...db[best] };
  }

  return { found: false, error: `No entry found for: "${fact}". Try keywords like: gravity, kinetic energy, ohm's law, quadratic formula...` };
}

// Export for background.js (service worker module style)
// These will be called via chrome.runtime.sendMessage dispatch
