// Original placeholder pilot content. Nothing here is copied from official papers or third-party apps.
// Exam dates are deliberately null: set them in the admin only from a verified official source.
// Coefficients are placeholders to be verified against the official regulations.

export type L = { en?: string; fr?: string };
/** An answer option; a wrong option may name the misconception that choosing it reveals. */
export type Opt = [en: string, fr: string, correct?: boolean, misconception?: L];

export interface SeedQuestion {
  key: string;
  type: "single_choice" | "multiple_choice" | "true_false" | "numeric";
  difficulty: number;
  prompt: L;
  options?: Opt[];
  numeric?: [answer: number, tolerance: number];
  explanation: L;
  /** Skill key within the chapter. Chapters without skills are assessed as a whole. */
  skill?: string;
  /** "checkpoint" questions are asked inside a lesson and kept out of practice. */
  purpose?: "practice" | "checkpoint";
  hint?: L;
}

export interface SeedLesson {
  key: string;
  title: L;
  minutes: number;
  /** Markdown; `## ` headings split it into blocks. Keep the same headings in every language. */
  body: L;
  status?: "draft" | "published";
  /** Checkpoint question keys and the block they follow. */
  checkpoints?: { question: string; afterBlock: number }[];
}

export interface SeedChapter {
  key: string;
  subject: string;
  title: L;
  status?: "draft" | "published";
  skills?: { key: string; name: L }[];
  lessons: SeedLesson[];
  questions: SeedQuestion[];
}

export interface SeedTrack {
  slug: string;
  name: L;
  subjects: [slug: string, coefficient: number][];
  chapters: SeedChapter[];
}

/** Grading rules per exam. GCE grade scales and subject limits are placeholders to verify. */
export type SeedProgram =
  | { kind: "grades"; grades: string[]; passGrades: string[]; minSubjects: number; maxSubjects: number }
  | { kind: "average"; scale: number; passMark: number; mentions: { min: number; label: L }[] };

const FRENCH_AVERAGE: SeedProgram = {
  kind: "average",
  scale: 20,
  passMark: 10,
  mentions: [
    { min: 10, label: { fr: "Passable", en: "Pass" } },
    { min: 12, label: { fr: "Assez bien", en: "Fairly good" } },
    { min: 14, label: { fr: "Bien", en: "Good" } },
    { min: 16, label: { fr: "Très bien", en: "Very good" } },
  ],
};

export interface SeedExam {
  slug: string;
  program: SeedProgram;
  name: L;
  description: L;
  level: string;
  primaryLanguage: "en" | "fr";
  tracks: SeedTrack[];
}

export const subjects: { slug: string; name: L; icon: string }[] = [
  { slug: "mathematics", name: { en: "Mathematics", fr: "Mathématiques" }, icon: "calculator" },
  { slug: "physics", name: { en: "Physics", fr: "Physique" }, icon: "atom" },
  { slug: "chemistry", name: { en: "Chemistry", fr: "Chimie" }, icon: "flask" },
  { slug: "biology", name: { en: "Biology", fr: "SVT (Sciences de la Vie et de la Terre)" }, icon: "leaf" },
  { slug: "english-language", name: { en: "English Language", fr: "Anglais" }, icon: "book" },
  { slug: "french", name: { en: "French", fr: "Français" }, icon: "language" },
  { slug: "history", name: { en: "History", fr: "Histoire" }, icon: "landmark" },
  { slug: "geography", name: { en: "Geography", fr: "Géographie" }, icon: "globe" },
  { slug: "philosophy", name: { en: "Philosophy", fr: "Philosophie" }, icon: "brain" },
  { slug: "literature", name: { en: "Literature in English", fr: "Littérature" }, icon: "feather" },
  { slug: "economics", name: { en: "Economics", fr: "Économie" }, icon: "chart" },
  { slug: "computer-science", name: { en: "Computer Science", fr: "Informatique" }, icon: "cpu" },
];

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

const quadratics: SeedChapter = {
  key: "gce-ol-maths-quadratics",
  subject: "mathematics",
  title: { en: "Quadratic equations", fr: "Équations du second degré" },
  lessons: [
    {
      key: "quadratics-intro",
      title: { en: "Solving quadratic equations", fr: "Résoudre une équation du second degré" },
      minutes: 12,
      body: {
        en: `# Quadratic equations

A quadratic equation has the form **ax² + bx + c = 0**, where a ≠ 0.

## 1. Solving by factorisation

If the expression factorises, set each factor to zero:

x² − 5x + 6 = 0 → (x − 2)(x − 3) = 0 → **x = 2 or x = 3**

## 2. The quadratic formula

When factorising is hard, use:

**x = (−b ± √(b² − 4ac)) / 2a**

## 3. The discriminant Δ = b² − 4ac

- Δ > 0: two distinct real roots
- Δ = 0: one repeated root
- Δ < 0: no real roots

## Worked example

Solve 2x² + 3x − 2 = 0.

a = 2, b = 3, c = −2, so Δ = 9 + 16 = 25 and √Δ = 5.

x = (−3 + 5)/4 = **1/2** or x = (−3 − 5)/4 = **−2**.

## Useful facts

For roots x₁ and x₂: **x₁ + x₂ = −b/a** and **x₁ · x₂ = c/a**.

> Exam tip: always check your roots by substituting them back into the equation.`,
        fr: `# Équations du second degré

Une équation du second degré s'écrit **ax² + bx + c = 0**, avec a ≠ 0.

## 1. Résolution par factorisation

Si l'expression se factorise, on annule chaque facteur :

x² − 5x + 6 = 0 → (x − 2)(x − 3) = 0 → **x = 2 ou x = 3**

## 2. La formule générale

**x = (−b ± √(b² − 4ac)) / 2a**

## 3. Le discriminant Δ = b² − 4ac

- Δ > 0 : deux racines réelles distinctes
- Δ = 0 : une racine double
- Δ < 0 : aucune racine réelle

## Exemple corrigé

Résoudre 2x² + 3x − 2 = 0.

a = 2, b = 3, c = −2, donc Δ = 9 + 16 = 25 et √Δ = 5.

x = (−3 + 5)/4 = **1/2** ou x = (−3 − 5)/4 = **−2**.

## À retenir

Pour les racines x₁ et x₂ : **x₁ + x₂ = −b/a** et **x₁ · x₂ = c/a**.

> Conseil d'examen : vérifiez toujours vos racines en les remplaçant dans l'équation.`,
      },
    },
    {
      key: "quadratics-simultaneous-draft",
      status: "draft",
      title: { en: "Quadratic and linear simultaneous equations", fr: "Systèmes avec une équation du second degré" },
      minutes: 15,
      body: { en: "# Draft\n\nThis lesson is waiting for review.", fr: "# Brouillon\n\nCette leçon attend une relecture." },
    },
  ],
  questions: [
    {
      key: "q1",
      type: "single_choice",
      difficulty: 1,
      prompt: { en: "Solve x² − 7x + 12 = 0.", fr: "Résoudre x² − 7x + 12 = 0." },
      options: [
        ["x = 3 or x = 4", "x = 3 ou x = 4", true],
        ["x = −3 or x = −4", "x = −3 ou x = −4"],
        ["x = 2 or x = 6", "x = 2 ou x = 6"],
        ["x = 1 or x = 12", "x = 1 ou x = 12"],
      ],
      explanation: {
        en: "x² − 7x + 12 = (x − 3)(x − 4). Check: 3 + 4 = 7 and 3 × 4 = 12.",
        fr: "x² − 7x + 12 = (x − 3)(x − 4). Vérification : 3 + 4 = 7 et 3 × 4 = 12.",
      },
    },
    {
      key: "q2",
      type: "numeric",
      difficulty: 2,
      prompt: { en: "Calculate the discriminant of x² + 2x + 5.", fr: "Calculer le discriminant de x² + 2x + 5." },
      numeric: [-16, 0],
      explanation: { en: "Δ = b² − 4ac = 4 − 20 = −16.", fr: "Δ = b² − 4ac = 4 − 20 = −16." },
    },
    {
      key: "q3",
      type: "single_choice",
      difficulty: 1,
      prompt: { en: "If Δ < 0, the equation ax² + bx + c = 0 has…", fr: "Si Δ < 0, l'équation ax² + bx + c = 0 admet…" },
      options: [
        ["no real roots", "aucune racine réelle", true],
        ["one repeated root", "une racine double"],
        ["two distinct real roots", "deux racines réelles distinctes"],
        ["infinitely many roots", "une infinité de racines"],
      ],
      explanation: {
        en: "The square root of a negative number is not real, so there are no real solutions.",
        fr: "La racine carrée d'un nombre négatif n'est pas réelle : il n'y a pas de solution réelle.",
      },
    },
    {
      key: "q4",
      type: "numeric",
      difficulty: 3,
      prompt: {
        en: "What is the sum of the roots of 2x² − 8x + 3 = 0?",
        fr: "Quelle est la somme des racines de 2x² − 8x + 3 = 0 ?",
      },
      numeric: [4, 0],
      explanation: { en: "Sum of roots = −b/a = 8/2 = 4.", fr: "Somme des racines = −b/a = 8/2 = 4." },
    },
    {
      key: "q5",
      type: "multiple_choice",
      difficulty: 3,
      prompt: {
        en: "Which equations have x = 2 as a root? Select all that apply.",
        fr: "Quelles équations admettent x = 2 comme racine ? Cochez toutes les bonnes réponses.",
      },
      options: [
        ["x² − 4 = 0", "x² − 4 = 0", true],
        ["x² − 5x + 6 = 0", "x² − 5x + 6 = 0", true],
        ["x² + 4 = 0", "x² + 4 = 0"],
        ["x² − 2x = 0", "x² − 2x = 0", true],
      ],
      explanation: {
        en: "Substitute x = 2: 4 − 4 = 0, 4 − 10 + 6 = 0 and 4 − 4 = 0 all work; 4 + 4 = 8 ≠ 0.",
        fr: "En remplaçant x par 2 : 4 − 4 = 0, 4 − 10 + 6 = 0 et 4 − 4 = 0 ; mais 4 + 4 = 8 ≠ 0.",
      },
    },
  ],
};

const kinematics: SeedChapter = {
  key: "gce-ol-physics-kinematics",
  subject: "physics",
  title: { en: "Speed, velocity and acceleration", fr: "Vitesse et accélération" },
  lessons: [
    {
      key: "kinematics-intro",
      title: { en: "Describing motion", fr: "Décrire un mouvement" },
      minutes: 10,
      body: {
        en: `# Describing motion

## Speed and velocity

- **Speed** = distance ÷ time (a scalar, unit m/s).
- **Velocity** is speed in a given direction (a vector).

## Acceleration

Acceleration is the rate of change of velocity:

**a = (v − u) / t**, measured in **m/s²**.

## Equations of uniformly accelerated motion

- v = u + at
- s = ut + ½at²
- v² = u² + 2as

where u is the initial velocity, v the final velocity, s the displacement and t the time.

## Worked example

A cyclist starts from rest and accelerates at 2 m/s² for 3 s.
Distance: s = 0 × 3 + ½ × 2 × 3² = **9 m**.`,
        fr: `# Décrire un mouvement

## Vitesse

- **Vitesse moyenne** = distance ÷ durée (en m/s).
- Le **vecteur vitesse** possède en plus une direction et un sens.

## Accélération

**a = (v − u) / t**, en **m/s²**.

## Mouvement uniformément accéléré

- v = u + at
- s = ut + ½at²
- v² = u² + 2as

## Exemple

Un cycliste part du repos avec a = 2 m/s² pendant 3 s : s = ½ × 2 × 3² = **9 m**.`,
      },
    },
  ],
  questions: [
    {
      key: "q1",
      type: "numeric",
      difficulty: 1,
      prompt: {
        en: "A bus travels 150 km in 2.5 hours. What is its average speed in km/h?",
        fr: "Un bus parcourt 150 km en 2,5 heures. Quelle est sa vitesse moyenne en km/h ?",
      },
      numeric: [60, 0],
      explanation: { en: "150 ÷ 2.5 = 60 km/h.", fr: "150 ÷ 2,5 = 60 km/h." },
    },
    {
      key: "q2",
      type: "numeric",
      difficulty: 2,
      prompt: {
        en: "A car accelerates uniformly from rest to 20 m/s in 5 s. Find its acceleration in m/s².",
        fr: "Une voiture passe du repos à 20 m/s en 5 s. Calculer son accélération en m/s².",
      },
      numeric: [4, 0],
      explanation: { en: "a = (20 − 0) / 5 = 4 m/s².", fr: "a = (20 − 0) / 5 = 4 m/s²." },
    },
    {
      key: "q3",
      type: "single_choice",
      difficulty: 1,
      prompt: { en: "What is the SI unit of acceleration?", fr: "Quelle est l'unité SI de l'accélération ?" },
      options: [
        ["m/s²", "m/s²", true],
        ["m/s", "m/s"],
        ["N", "N"],
        ["km/h", "km/h"],
      ],
      explanation: {
        en: "Acceleration is change of velocity (m/s) per second, so m/s².",
        fr: "C'est une variation de vitesse (m/s) par seconde, donc m/s².",
      },
    },
    {
      key: "q4",
      type: "true_false",
      difficulty: 1,
      prompt: {
        en: "True or false: velocity has both magnitude and direction.",
        fr: "Vrai ou faux : la vitesse vectorielle possède une valeur et une direction.",
      },
      options: [
        ["True", "Vrai", true],
        ["False", "Faux"],
      ],
      explanation: { en: "Velocity is a vector quantity.", fr: "La vitesse vectorielle est un vecteur." },
    },
    {
      key: "q5",
      type: "numeric",
      difficulty: 3,
      prompt: {
        en: "An object starts from rest with a = 2 m/s². How far (in m) does it travel in 3 s?",
        fr: "Un objet part du repos avec a = 2 m/s². Quelle distance (en m) parcourt-il en 3 s ?",
      },
      numeric: [9, 0],
      explanation: { en: "s = ½ × 2 × 3² = 9 m.", fr: "s = ½ × 2 × 3² = 9 m." },
    },
  ],
};

const differentiation: SeedChapter = {
  key: "gce-al-maths-differentiation",
  subject: "mathematics",
  title: { en: "Differentiation", fr: "Dérivation" },
  lessons: [
    {
      key: "differentiation-rules",
      title: { en: "Rules of differentiation", fr: "Règles de dérivation" },
      minutes: 15,
      body: {
        en: `# Rules of differentiation

The derivative f'(x) measures the rate of change (gradient) of f at x.

## Standard results

| f(x) | f'(x) |
|---|---|
| xⁿ | n·xⁿ⁻¹ |
| sin x | cos x |
| cos x | −sin x |
| eˣ | eˣ |
| ln x | 1/x |

## Rules

- **Product:** (uv)' = u'v + uv'
- **Quotient:** (u/v)' = (u'v − uv') / v²
- **Chain:** d/dx f(g(x)) = f'(g(x)) · g'(x)

## Stationary points

Solve f'(x) = 0. Then use f''(x): positive → minimum, negative → maximum.

## Example

y = x² − 6x + 1 → y' = 2x − 6 = 0 → x = 3, and y'' = 2 > 0, so it is a **minimum**.`,
        fr: `# Règles de dérivation

| f(x) | f'(x) |
|---|---|
| xⁿ | n·xⁿ⁻¹ |
| sin x | cos x |
| cos x | −sin x |
| eˣ | eˣ |
| ln x | 1/x |

- **Produit :** (uv)' = u'v + uv'
- **Quotient :** (u/v)' = (u'v − uv') / v²
- **Composée :** (f∘g)' = (f'∘g) · g'

## Points stationnaires

On résout f'(x) = 0, puis on étudie le signe de f''(x).`,
      },
    },
  ],
  questions: [
    {
      key: "q1",
      type: "single_choice",
      difficulty: 1,
      prompt: { en: "Differentiate x³ with respect to x.", fr: "Dériver x³ par rapport à x." },
      options: [
        ["3x²", "3x²", true],
        ["x²", "x²"],
        ["3x³", "3x³"],
        ["x⁴/4", "x⁴/4"],
      ],
      explanation: { en: "Power rule: n·xⁿ⁻¹ = 3x².", fr: "Règle de la puissance : n·xⁿ⁻¹ = 3x²." },
    },
    {
      key: "q2",
      type: "numeric",
      difficulty: 2,
      prompt: { en: "If f(x) = 5x² − 3x, find f'(2).", fr: "Si f(x) = 5x² − 3x, calculer f'(2)." },
      numeric: [17, 0],
      explanation: { en: "f'(x) = 10x − 3, so f'(2) = 17.", fr: "f'(x) = 10x − 3, donc f'(2) = 17." },
    },
    {
      key: "q3",
      type: "single_choice",
      difficulty: 3,
      prompt: { en: "Differentiate sin(2x).", fr: "Dériver sin(2x)." },
      options: [
        ["2cos(2x)", "2cos(2x)", true],
        ["cos(2x)", "cos(2x)"],
        ["−2cos(2x)", "−2cos(2x)"],
        ["2sin(2x)", "2sin(2x)"],
      ],
      explanation: {
        en: "Chain rule: cos(2x) × d/dx(2x) = 2cos(2x).",
        fr: "Dérivée d'une composée : cos(2x) × 2 = 2cos(2x).",
      },
    },
    {
      key: "q4",
      type: "numeric",
      difficulty: 2,
      prompt: {
        en: "At what value of x does y = x² − 6x + 1 have a stationary point?",
        fr: "Pour quelle valeur de x la fonction y = x² − 6x + 1 a-t-elle un point stationnaire ?",
      },
      numeric: [3, 0],
      explanation: { en: "y' = 2x − 6 = 0 gives x = 3.", fr: "y' = 2x − 6 = 0 donne x = 3." },
    },
  ],
};

const moles: SeedChapter = {
  key: "gce-al-chem-moles",
  subject: "chemistry",
  title: { en: "The mole concept", fr: "La notion de mole" },
  lessons: [
    {
      key: "moles-intro",
      title: { en: "Amount of substance", fr: "Quantité de matière" },
      minutes: 12,
      body: {
        en: `# The mole concept

One **mole** contains Avogadro's number of particles: **L ≈ 6.02 × 10²³ mol⁻¹**.

## Key relationships

- **n = m / M** (moles = mass ÷ molar mass)
- **c = n / V** (concentration in mol/dm³, with V in dm³)
- Number of particles = n × L

## Molar mass

Add the relative atomic masses: M(CO₂) = 12 + 2 × 16 = **44 g/mol**.

## Worked example

How many moles are in 36 g of water (M = 18 g/mol)? n = 36 / 18 = **2 mol**.

> Remember: 1 dm³ = 1000 cm³.`,
        fr: `# La mole

Une **mole** contient **N_A ≈ 6,02 × 10²³** entités.

- **n = m / M**
- **C = n / V** (en mol/L)

Exemple : 36 g d'eau (M = 18 g/mol) → n = **2 mol**.`,
      },
    },
  ],
  questions: [
    {
      key: "q1",
      type: "numeric",
      difficulty: 1,
      prompt: {
        en: "How many moles are in 36 g of water? (M = 18 g/mol)",
        fr: "Combien de moles y a-t-il dans 36 g d'eau ? (M = 18 g/mol)",
      },
      numeric: [2, 0],
      explanation: { en: "n = m/M = 36/18 = 2 mol.", fr: "n = m/M = 36/18 = 2 mol." },
    },
    {
      key: "q2",
      type: "numeric",
      difficulty: 1,
      prompt: {
        en: "Calculate the molar mass of CO₂ in g/mol. (C = 12, O = 16)",
        fr: "Calculer la masse molaire de CO₂ en g/mol. (C = 12, O = 16)",
      },
      numeric: [44, 0],
      explanation: { en: "12 + 2 × 16 = 44 g/mol.", fr: "12 + 2 × 16 = 44 g/mol." },
    },
    {
      key: "q3",
      type: "single_choice",
      difficulty: 1,
      prompt: { en: "What is the approximate value of the Avogadro constant?", fr: "Quelle est la valeur approchée de la constante d'Avogadro ?" },
      options: [
        ["6.02 × 10²³ mol⁻¹", "6,02 × 10²³ mol⁻¹", true],
        ["6.02 × 10⁻²³ mol⁻¹", "6,02 × 10⁻²³ mol⁻¹"],
        ["3.00 × 10⁸ mol⁻¹", "3,00 × 10⁸ mol⁻¹"],
        ["1.60 × 10⁻¹⁹ mol⁻¹", "1,60 × 10⁻¹⁹ mol⁻¹"],
      ],
      explanation: { en: "L ≈ 6.02 × 10²³ particles per mole.", fr: "N_A ≈ 6,02 × 10²³ entités par mole." },
    },
    {
      key: "q4",
      type: "numeric",
      difficulty: 3,
      prompt: {
        en: "0.5 mol of NaCl is dissolved to make 250 cm³ of solution. What is the concentration in mol/dm³?",
        fr: "On dissout 0,5 mol de NaCl pour obtenir 250 mL de solution. Quelle est la concentration en mol/L ?",
      },
      numeric: [2, 0],
      explanation: { en: "250 cm³ = 0.25 dm³, so c = 0.5 / 0.25 = 2 mol/dm³.", fr: "250 mL = 0,25 L, donc C = 0,5 / 0,25 = 2 mol/L." },
    },
  ],
};

const trinome: SeedChapter = {
  key: "proba-c-maths-trinome",
  subject: "mathematics",
  title: { fr: "Polynômes du second degré", en: "Second-degree polynomials" },
  lessons: [
    {
      key: "trinome-intro",
      title: { fr: "Forme canonique, discriminant et signe", en: "Canonical form, discriminant and sign" },
      minutes: 15,
      body: {
        fr: `# Polynômes du second degré

Un trinôme s'écrit **P(x) = ax² + bx + c**, avec a ≠ 0.

## Forme canonique

**P(x) = a[(x + b/2a)² − Δ/4a²]** où **Δ = b² − 4ac**.

Exemple : x² + 4x + 1 = (x + 2)² − 3.

## Racines

- Δ > 0 : x₁ = (−b − √Δ)/2a et x₂ = (−b + √Δ)/2a
- Δ = 0 : racine double x₀ = −b/2a
- Δ < 0 : pas de racine réelle

## Somme et produit

**S = x₁ + x₂ = −b/a** et **P = x₁ · x₂ = c/a**.

## Signe du trinôme

- Si Δ < 0, P(x) est toujours du **signe de a**.
- Si Δ > 0, P(x) est du signe de a **à l'extérieur** des racines, du signe contraire **entre** les racines.`,
        en: `# Second-degree polynomials

**P(x) = ax² + bx + c**, a ≠ 0, with discriminant **Δ = b² − 4ac**.

- Canonical form: x² + 4x + 1 = (x + 2)² − 3.
- Sum of roots −b/a, product c/a.
- If Δ < 0, P(x) always has the **sign of a**.
- If Δ > 0, P(x) has the sign of a outside the roots and the opposite sign between them.`,
      },
    },
  ],
  questions: [
    {
      key: "q1",
      type: "single_choice",
      difficulty: 1,
      prompt: { fr: "Résoudre x² − x − 6 = 0.", en: "Solve x² − x − 6 = 0." },
      options: [
        ["x = −2 or x = 3", "x = −2 ou x = 3", true],
        ["x = 2 or x = −3", "x = 2 ou x = −3"],
        ["x = 1 or x = 6", "x = 1 ou x = 6"],
        ["No real root", "Pas de racine réelle"],
      ],
      explanation: {
        fr: "Δ = 1 + 24 = 25, donc x = (1 ± 5)/2, soit −2 ou 3.",
        en: "Δ = 1 + 24 = 25, so x = (1 ± 5)/2, giving −2 or 3.",
      },
    },
    {
      key: "q2",
      type: "single_choice",
      difficulty: 2,
      prompt: { fr: "Quel est le signe de P(x) = 2x² + x + 1 ?", en: "What is the sign of P(x) = 2x² + x + 1?" },
      options: [
        ["Always strictly positive", "Toujours strictement positif", true],
        ["Always negative", "Toujours négatif"],
        ["Changes sign", "Change de signe"],
        ["Zero at x = 1", "S'annule en x = 1"],
      ],
      explanation: {
        fr: "Δ = 1 − 8 = −7 < 0 : P(x) est toujours du signe de a = 2 > 0.",
        en: "Δ = 1 − 8 = −7 < 0, so P(x) always has the sign of a = 2 > 0.",
      },
    },
    {
      key: "q3",
      type: "single_choice",
      difficulty: 2,
      prompt: { fr: "Forme canonique de x² + 4x + 1 :", en: "Canonical form of x² + 4x + 1:" },
      options: [
        ["(x + 2)² − 3", "(x + 2)² − 3", true],
        ["(x + 2)² + 1", "(x + 2)² + 1"],
        ["(x − 2)² − 3", "(x − 2)² − 3"],
        ["(x + 4)² − 15", "(x + 4)² − 15"],
      ],
      explanation: { fr: "(x + 2)² = x² + 4x + 4, donc x² + 4x + 1 = (x + 2)² − 3.", en: "(x + 2)² = x² + 4x + 4, so subtract 3." },
    },
    {
      key: "q4",
      type: "numeric",
      difficulty: 2,
      prompt: {
        fr: "Produit des racines de 3x² − 12x + 9 = 0 ?",
        en: "Product of the roots of 3x² − 12x + 9 = 0?",
      },
      numeric: [3, 0],
      explanation: { fr: "P = c/a = 9/3 = 3 (racines 1 et 3).", en: "Product = c/a = 9/3 = 3 (roots 1 and 3)." },
    },
  ],
};

const travail: SeedChapter = {
  key: "proba-c-physique-travail",
  subject: "physics",
  title: { fr: "Travail et puissance", en: "Work and power" },
  lessons: [
    {
      key: "travail-intro",
      title: { fr: "Travail d'une force et puissance", en: "Work done by a force and power" },
      minutes: 12,
      body: {
        fr: `# Travail et puissance

## Travail d'une force constante

**W = F × d × cos α**, en **joules (J)**, où α est l'angle entre la force et le déplacement.

- α = 0 : travail moteur maximal, W = F·d
- α = 90° : **travail nul**
- α > 90° : travail résistant (négatif)

## Travail du poids

**W = m × g × h** (h : dénivellation), positif à la descente.

## Puissance

**P = W / t**, en **watts (W)**.`,
        en: `# Work and power

- **W = F × d × cos α** (joules). A force perpendicular to the motion does **no work**.
- Work done by weight: **W = m g h**.
- Power: **P = W / t** (watts).`,
      },
    },
  ],
  questions: [
    {
      key: "q1",
      type: "numeric",
      difficulty: 1,
      prompt: {
        fr: "Une force de 50 N déplace un objet de 4 m dans sa propre direction. Travail en J ?",
        en: "A 50 N force moves an object 4 m in its own direction. Work done in J?",
      },
      numeric: [200, 0],
      explanation: { fr: "W = 50 × 4 × cos 0 = 200 J.", en: "W = 50 × 4 × cos 0 = 200 J." },
    },
    {
      key: "q2",
      type: "single_choice",
      difficulty: 1,
      prompt: {
        fr: "Le travail d'une force perpendiculaire au déplacement est :",
        en: "The work done by a force perpendicular to the displacement is:",
      },
      options: [
        ["Zero", "Nul", true],
        ["Maximal", "Maximal"],
        ["Negative", "Négatif"],
        ["Equal to F × d", "Égal à F × d"],
      ],
      explanation: { fr: "cos 90° = 0, donc W = 0.", en: "cos 90° = 0, so W = 0." },
    },
    {
      key: "q3",
      type: "numeric",
      difficulty: 2,
      prompt: {
        fr: "Un moteur fournit un travail de 1200 J en 4 s. Puissance en W ?",
        en: "A motor does 1200 J of work in 4 s. Power in W?",
      },
      numeric: [300, 0],
      explanation: { fr: "P = 1200 / 4 = 300 W.", en: "P = 1200 / 4 = 300 W." },
    },
  ],
};

// Vertical slice for the learning loop (BAC Série D, Mathématiques): skills, checkpoints, hints and
// misconception tags. Original demonstration content, not taken from official papers.
const SIGN_I2: L = { fr: "Oubli que i² = −1", en: "Forgetting that i² = −1" };
const FACE_TO_FACE: L = {
  fr: "Seuls les termes « face à face » ont été multipliés : il faut développer tous les produits",
  en: "Only the matching terms were multiplied: expand every product",
};
const NO_ROOT: L = { fr: "Oubli de la racine carrée : |z| = √(a² + b²)", en: "Forgetting the square root: |z| = √(a² + b²)" };

const complexes: SeedChapter = {
  key: "bac-d-maths-complexes",
  subject: "mathematics",
  title: { fr: "Nombres complexes", en: "Complex numbers" },
  skills: [
    { key: "forme-algebrique", name: { fr: "Forme algébrique et calculs", en: "Algebraic form and arithmetic" } },
    { key: "conjugue", name: { fr: "Conjugué", en: "Conjugate" } },
    { key: "module-argument", name: { fr: "Module et argument", en: "Modulus and argument" } },
  ],
  lessons: [
    {
      key: "complexes-intro",
      title: { fr: "Forme algébrique, module et conjugué", en: "Algebraic form, modulus and conjugate" },
      minutes: 15,
      checkpoints: [
        { question: "c1", afterBlock: 1 },
        { question: "c2", afterBlock: 2 },
        { question: "c3", afterBlock: 3 },
      ],
      body: {
        fr: `# Nombres complexes

On pose **i² = −1**. Tout nombre complexe s'écrit de façon unique **z = a + ib**, avec a et b réels :
a est la **partie réelle** (Re z) et b la **partie imaginaire** (Im z). Attention : Im z est le réel b, pas ib.

## Calculer avec la forme algébrique

On calcule comme avec des polynômes en i, puis on remplace **i² par −1**.

- Somme : (a + ib) + (c + id) = (a + c) + i(b + d)
- Produit : on développe **tous** les termes.

Exemple : (2 + 3i)(4 − i) = 8 − 2i + 12i − 3i² = 8 + 10i + 3 = **11 + 10i**.

## Le conjugué

Le conjugué de z = a + ib est **z̄ = a − ib** : seule la partie imaginaire change de signe.

- z · z̄ = a² + b², un réel positif.
- Pour écrire un quotient sous forme algébrique, on multiplie en haut et en bas par le conjugué du dénominateur.

Exemple : 1/(2 − i) = (2 + i)/((2 − i)(2 + i)) = (2 + i)/5 = **2/5 + (1/5)i**.

## Module et argument

- Module : **|z| = √(a² + b²)**, la distance de l'origine au point d'affixe z.
- Si z ≠ 0, un argument θ vérifie cos θ = a/|z| et sin θ = b/|z|.

Exemples : |3 + 4i| = √(9 + 16) = **5** ; arg(i) = **π/2** ; arg(−1) = **π**.

## À retenir

- i² = −1 : à appliquer après chaque développement.
- Conjugué : on change seulement le signe de la partie imaginaire.
- Module : n'oublie pas la racine carrée.`,
        en: `# Complex numbers

We set **i² = −1**. Every complex number can be written in exactly one way as **z = a + ib**, with a and b real:
a is the **real part** (Re z) and b the **imaginary part** (Im z). Careful: Im z is the real number b, not ib.

## Calculating in algebraic form

Calculate as with polynomials in i, then replace **i² with −1**.

- Sum: (a + ib) + (c + id) = (a + c) + i(b + d)
- Product: expand **every** term.

Example: (2 + 3i)(4 − i) = 8 − 2i + 12i − 3i² = 8 + 10i + 3 = **11 + 10i**.

## The conjugate

The conjugate of z = a + ib is **z̄ = a − ib**: only the imaginary part changes sign.

- z · z̄ = a² + b², a non-negative real number.
- To write a quotient in algebraic form, multiply top and bottom by the conjugate of the denominator.

Example: 1/(2 − i) = (2 + i)/((2 − i)(2 + i)) = (2 + i)/5 = **2/5 + (1/5)i**.

## Modulus and argument

- Modulus: **|z| = √(a² + b²)**, the distance from the origin to the point z.
- If z ≠ 0, an argument θ satisfies cos θ = a/|z| and sin θ = b/|z|.

Examples: |3 + 4i| = √(9 + 16) = **5**; arg(i) = **π/2**; arg(−1) = **π**.

## Key points

- i² = −1: apply it after every expansion.
- Conjugate: change only the sign of the imaginary part.
- Modulus: don't forget the square root.`,
      },
    },
  ],
  questions: [
    // --- Checkpoints inside the lesson ---
    {
      key: "c1",
      skill: "forme-algebrique",
      purpose: "checkpoint",
      type: "single_choice",
      difficulty: 1,
      prompt: { fr: "(2 + 3i)(1 − i) = ?", en: "(2 + 3i)(1 − i) = ?" },
      options: [
        ["5 + i", "5 + i", true],
        ["−1 + i", "−1 + i", false, SIGN_I2],
        ["2 − 3i", "2 − 3i", false, FACE_TO_FACE],
        ["5 − i", "5 − i"],
      ],
      hint: { fr: "Développe les quatre produits, puis remplace i² par −1.", en: "Expand all four products, then replace i² with −1." },
      explanation: { fr: "2 − 2i + 3i − 3i² = 2 + i + 3 = 5 + i.", en: "2 − 2i + 3i − 3i² = 2 + i + 3 = 5 + i." },
    },
    {
      key: "c2",
      skill: "conjugue",
      purpose: "checkpoint",
      type: "single_choice",
      difficulty: 1,
      prompt: { fr: "Conjugué de −3 + 2i :", en: "Conjugate of −3 + 2i:" },
      options: [
        ["−3 − 2i", "−3 − 2i", true],
        ["3 − 2i", "3 − 2i", false, { fr: "On a aussi changé le signe de la partie réelle", en: "The real part's sign was changed too" }],
        ["3 + 2i", "3 + 2i", false, { fr: "Seule la partie réelle a changé de signe", en: "Only the real part's sign was changed" }],
        ["−3 + 2i", "−3 + 2i"],
      ],
      hint: { fr: "Le conjugué ne change que le signe de la partie imaginaire.", en: "The conjugate only changes the sign of the imaginary part." },
      explanation: { fr: "z̄ = a − ib : −3 + 2i devient −3 − 2i.", en: "z̄ = a − ib: −3 + 2i becomes −3 − 2i." },
    },
    {
      key: "c3",
      skill: "module-argument",
      purpose: "checkpoint",
      type: "numeric",
      difficulty: 1,
      prompt: { fr: "Module de z = 6 − 8i ?", en: "Modulus of z = 6 − 8i?" },
      numeric: [10, 0],
      hint: { fr: "Calcule √(6² + (−8)²).", en: "Work out √(6² + (−8)²)." },
      explanation: { fr: "|z| = √(36 + 64) = √100 = 10.", en: "|z| = √(36 + 64) = √100 = 10." },
    },

    // --- Practice: algebraic form ---
    {
      key: "fa1",
      skill: "forme-algebrique",
      type: "single_choice",
      difficulty: 1,
      prompt: { fr: "Partie imaginaire de z = 4 − 7i :", en: "Imaginary part of z = 4 − 7i:" },
      options: [
        ["−7", "−7", true],
        ["7", "7", false, { fr: "Le signe de la partie imaginaire a été oublié", en: "The sign of the imaginary part was dropped" }],
        ["−7i", "−7i", false, { fr: "La partie imaginaire est le réel b, pas ib", en: "The imaginary part is the real number b, not ib" }],
        ["4", "4"],
      ],
      hint: { fr: "Écris z = a + ib et identifie b.", en: "Write z = a + ib and read off b." },
      explanation: { fr: "z = 4 + (−7)i, donc Im z = −7 (un réel).", en: "z = 4 + (−7)i, so Im z = −7 (a real number)." },
    },
    {
      key: "fa2",
      skill: "forme-algebrique",
      type: "single_choice",
      difficulty: 1,
      prompt: { fr: "(3 + 2i) + (1 − 5i) = ?", en: "(3 + 2i) + (1 − 5i) = ?" },
      options: [
        ["4 − 3i", "4 − 3i", true],
        ["4 + 7i", "4 + 7i", false, { fr: "Erreur de signe sur −5i", en: "Sign error on −5i" }],
        ["3 − 10i", "3 − 10i", false, { fr: "Multiplication au lieu d'addition", en: "Multiplied instead of added" }],
        ["2 + 7i", "2 + 7i"],
      ],
      hint: { fr: "Additionne les parties réelles entre elles, puis les parties imaginaires.", en: "Add the real parts together, then the imaginary parts." },
      explanation: { fr: "(3 + 1) + (2 − 5)i = 4 − 3i.", en: "(3 + 1) + (2 − 5)i = 4 − 3i." },
    },
    {
      key: "fa3",
      skill: "forme-algebrique",
      type: "single_choice",
      difficulty: 2,
      prompt: { fr: "(2 + i)(1 + 3i) = ?", en: "(2 + i)(1 + 3i) = ?" },
      options: [
        ["−1 + 7i", "−1 + 7i", true],
        ["5 + 7i", "5 + 7i", false, SIGN_I2],
        ["2 + 3i", "2 + 3i", false, FACE_TO_FACE],
        ["−1 + 3i", "−1 + 3i"],
      ],
      hint: { fr: "Développe : 2·1 + 2·3i + i·1 + i·3i.", en: "Expand: 2·1 + 2·3i + i·1 + i·3i." },
      explanation: { fr: "2 + 6i + i + 3i² = 2 + 7i − 3 = −1 + 7i.", en: "2 + 6i + i + 3i² = 2 + 7i − 3 = −1 + 7i." },
    },
    {
      key: "q3",
      skill: "forme-algebrique",
      type: "single_choice",
      difficulty: 2,
      prompt: { fr: "(1 + i)² = ?", en: "(1 + i)² = ?" },
      options: [
        ["2i", "2i", true],
        ["2", "2"],
        ["2 + 2i", "2 + 2i", false, SIGN_I2],
        ["0", "0"],
      ],
      hint: { fr: "Utilise (a + b)² = a² + 2ab + b².", en: "Use (a + b)² = a² + 2ab + b²." },
      explanation: { fr: "1 + 2i + i² = 1 + 2i − 1 = 2i.", en: "1 + 2i + i² = 1 + 2i − 1 = 2i." },
    },
    {
      key: "fa5",
      skill: "forme-algebrique",
      type: "single_choice",
      difficulty: 3,
      prompt: { fr: "i³ = ?", en: "i³ = ?" },
      options: [
        ["−i", "−i", true],
        ["i", "i", false, SIGN_I2],
        ["−1", "−1"],
        ["1", "1"],
      ],
      hint: { fr: "i³ = i² · i.", en: "i³ = i² · i." },
      explanation: { fr: "i³ = i² · i = −1 · i = −i.", en: "i³ = i² · i = −1 · i = −i." },
    },

    // --- Practice: conjugate ---
    {
      key: "q2",
      skill: "conjugue",
      type: "single_choice",
      difficulty: 1,
      prompt: { fr: "Conjugué de 2 − 5i :", en: "Conjugate of 2 − 5i:" },
      options: [
        ["2 + 5i", "2 + 5i", true],
        ["−2 + 5i", "−2 + 5i", false, { fr: "On a aussi changé le signe de la partie réelle", en: "The real part's sign was changed too" }],
        ["−2 − 5i", "−2 − 5i", false, { fr: "C'est l'opposé de z, pas son conjugué", en: "That is −z, not the conjugate" }],
        ["5 − 2i", "5 − 2i"],
      ],
      hint: { fr: "Ne change que le signe de la partie imaginaire.", en: "Only change the sign of the imaginary part." },
      explanation: { fr: "On change le signe de la partie imaginaire : 2 + 5i.", en: "Change the sign of the imaginary part: 2 + 5i." },
    },
    {
      key: "cj2",
      skill: "conjugue",
      type: "numeric",
      difficulty: 2,
      prompt: { fr: "Pour z = 3 + 4i, calcule z · z̄.", en: "For z = 3 + 4i, work out z · z̄." },
      numeric: [25, 0],
      hint: { fr: "z · z̄ = a² + b².", en: "z · z̄ = a² + b²." },
      explanation: { fr: "z · z̄ = 3² + 4² = 9 + 16 = 25.", en: "z · z̄ = 3² + 4² = 9 + 16 = 25." },
    },
    {
      key: "cj3",
      skill: "conjugue",
      type: "single_choice",
      difficulty: 2,
      prompt: { fr: "Conjugué de (1 + i)(2 − i) :", en: "Conjugate of (1 + i)(2 − i):" },
      options: [
        ["3 − i", "3 − i", true],
        ["3 + i", "3 + i", false, { fr: "Le produit est juste, mais le conjugué n'a pas été pris", en: "The product is right, but the conjugate wasn't taken" }],
        ["1 − i", "1 − i", false, SIGN_I2],
        ["−3 − i", "−3 − i"],
      ],
      hint: { fr: "Calcule d'abord le produit, puis prends son conjugué.", en: "Work out the product first, then take its conjugate." },
      explanation: { fr: "(1 + i)(2 − i) = 2 − i + 2i − i² = 3 + i, donc le conjugué est 3 − i.", en: "(1 + i)(2 − i) = 2 − i + 2i − i² = 3 + i, so the conjugate is 3 − i." },
    },
    {
      key: "cj4",
      skill: "conjugue",
      type: "single_choice",
      difficulty: 3,
      prompt: { fr: "Forme algébrique de 1/(1 + i) :", en: "Algebraic form of 1/(1 + i):" },
      options: [
        ["1/2 − (1/2)i", "1/2 − (1/2)i", true],
        ["1 − i", "1 − i", false, { fr: "Le dénominateur (1 + i)(1 − i) = 2 a été oublié", en: "The denominator (1 + i)(1 − i) = 2 was forgotten" }],
        ["1/2 + (1/2)i", "1/2 + (1/2)i", false, { fr: "Erreur de signe : le conjugué de 1 + i est 1 − i", en: "Sign error: the conjugate of 1 + i is 1 − i" }],
        ["1 + i", "1 + i"],
      ],
      hint: { fr: "Multiplie en haut et en bas par 1 − i.", en: "Multiply top and bottom by 1 − i." },
      explanation: { fr: "(1 − i)/((1 + i)(1 − i)) = (1 − i)/2 = 1/2 − (1/2)i.", en: "(1 − i)/((1 + i)(1 − i)) = (1 − i)/2 = 1/2 − (1/2)i." },
    },

    // --- Practice: modulus and argument ---
    {
      key: "q1",
      skill: "module-argument",
      type: "numeric",
      difficulty: 1,
      prompt: { fr: "Module de z = 3 + 4i ?", en: "Modulus of z = 3 + 4i?" },
      numeric: [5, 0],
      hint: { fr: "|z| = √(a² + b²).", en: "|z| = √(a² + b²)." },
      explanation: { fr: "|z| = √(9 + 16) = 5.", en: "|z| = √(9 + 16) = 5." },
    },
    {
      key: "q4",
      skill: "module-argument",
      type: "single_choice",
      difficulty: 2,
      prompt: { fr: "Un argument de i est :", en: "An argument of i is:" },
      options: [
        ["π/2", "π/2", true],
        ["π", "π"],
        ["0", "0"],
        ["−π/2", "−π/2", false, { fr: "Confusion entre i et −i", en: "Mixing up i and −i" }],
      ],
      hint: { fr: "Place i dans le plan : sur quel axe se trouve-t-il ?", en: "Plot i in the plane: which axis is it on?" },
      explanation: { fr: "i = cos(π/2) + i sin(π/2).", en: "i = cos(π/2) + i sin(π/2)." },
    },
    {
      key: "ma3",
      skill: "module-argument",
      type: "numeric",
      difficulty: 2,
      prompt: { fr: "Module de z = −5 + 12i ?", en: "Modulus of z = −5 + 12i?" },
      numeric: [13, 0],
      hint: { fr: "Le signe disparaît au carré : √(25 + 144).", en: "The sign disappears when squared: √(25 + 144)." },
      explanation: { fr: "|z| = √(25 + 144) = √169 = 13.", en: "|z| = √(25 + 144) = √169 = 13." },
    },
    {
      key: "ma4",
      skill: "module-argument",
      type: "single_choice",
      difficulty: 2,
      prompt: { fr: "Module de z = 1 + i :", en: "Modulus of z = 1 + i:" },
      options: [
        ["√2", "√2", true],
        ["2", "2", false, NO_ROOT],
        ["1", "1"],
        ["0", "0"],
      ],
      hint: { fr: "|z| = √(1² + 1²).", en: "|z| = √(1² + 1²)." },
      explanation: { fr: "|1 + i| = √(1 + 1) = √2.", en: "|1 + i| = √(1 + 1) = √2." },
    },
    {
      key: "ma5",
      skill: "module-argument",
      type: "single_choice",
      difficulty: 3,
      prompt: { fr: "Un argument de z = −2 :", en: "An argument of z = −2:" },
      options: [
        ["π", "π", true],
        ["0", "0", false, { fr: "Un réel négatif a pour argument π, pas 0", en: "A negative real number has argument π, not 0" }],
        ["π/2", "π/2"],
        ["−π/2", "−π/2"],
      ],
      hint: { fr: "Où se trouve −2 dans le plan complexe ?", en: "Where is −2 in the complex plane?" },
      explanation: { fr: "−2 = 2(cos π + i sin π), donc arg(−2) = π.", en: "−2 = 2(cos π + i sin π), so arg(−2) = π." },
    },
  ],
};

const mendel: SeedChapter = {
  key: "bac-d-svt-mendel",
  subject: "biology",
  title: { fr: "Génétique : les lois de Mendel", en: "Genetics: Mendel's laws" },
  lessons: [
    {
      key: "mendel-intro",
      title: { fr: "Monohybridisme", en: "Monohybrid crosses" },
      minutes: 12,
      body: {
        fr: `# Monohybridisme

- Un **gène** existe sous plusieurs formes : les **allèles**.
- **Homozygote** : deux allèles identiques (AA ou aa). **Hétérozygote** : deux allèles différents (Aa).
- Un allèle **dominant** (A) s'exprime même en un seul exemplaire ; un allèle **récessif** (a) seulement chez aa.

## Première loi : uniformité de la F1

Le croisement de deux lignées pures différant par un caractère donne une F1 **uniforme** (tous Aa).

## Deuxième loi : ségrégation

F1 × F1 (Aa × Aa) donne en F2 : ¼ AA, ½ Aa, ¼ aa, soit **3/4 phénotype dominant et 1/4 récessif**.`,
        en: `# Monohybrid crosses

- **Homozygous**: two identical alleles; **heterozygous**: two different alleles.
- Crossing two pure lines gives a **uniform F1** (all Aa).
- Aa × Aa gives **3 dominant : 1 recessive** phenotypes in F2.`,
      },
    },
  ],
  questions: [
    {
      key: "q1",
      type: "single_choice",
      difficulty: 2,
      prompt: {
        fr: "Aa × Aa : quelle proportion de descendants a le phénotype récessif ?",
        en: "Aa × Aa: what proportion of offspring show the recessive phenotype?",
      },
      options: [
        ["1/4", "1/4", true],
        ["1/2", "1/2"],
        ["3/4", "3/4"],
        ["0", "0"],
      ],
      explanation: { fr: "Seuls les aa (1/4) expriment le caractère récessif.", en: "Only aa offspring (1/4) show it." },
    },
    {
      key: "q2",
      type: "single_choice",
      difficulty: 1,
      prompt: {
        fr: "La F1 issue du croisement de deux lignées pures est :",
        en: "The F1 from crossing two pure lines is:",
      },
      options: [
        ["Uniform", "Uniforme", true],
        ["3:1 ratio", "En proportions 3:1"],
        ["1:1 ratio", "En proportions 1:1"],
        ["Unpredictable", "Imprévisible"],
      ],
      explanation: { fr: "Première loi de Mendel : uniformité des hybrides de F1.", en: "Mendel's first law: F1 hybrids are uniform." },
    },
    {
      key: "q3",
      type: "multiple_choice",
      difficulty: 2,
      prompt: {
        fr: "Quels génotypes sont hétérozygotes ? (plusieurs réponses)",
        en: "Which genotypes are heterozygous? (select all)",
      },
      options: [
        ["Aa", "Aa", true],
        ["Bb", "Bb", true],
        ["AA", "AA"],
        ["bb", "bb"],
      ],
      explanation: { fr: "Hétérozygote = deux allèles différents.", en: "Heterozygous means two different alleles." },
    },
  ],
};

const suites: SeedChapter = {
  key: "bac-c-maths-suites",
  subject: "mathematics",
  title: { fr: "Suites numériques", en: "Sequences" },
  lessons: [
    {
      key: "suites-intro",
      title: { fr: "Suites arithmétiques et géométriques", en: "Arithmetic and geometric sequences" },
      minutes: 15,
      body: {
        fr: `# Suites arithmétiques et géométriques

## Suite arithmétique de raison r

- **uₙ = u₀ + n·r**
- Somme de termes consécutifs : (nombre de termes) × (premier + dernier) / 2

## Suite géométrique de raison q

- **uₙ = u₀ · qⁿ**
- Somme : u₀ (1 − qⁿ⁺¹)/(1 − q) si q ≠ 1

## Convergence

Si **|q| < 1**, alors qⁿ → 0 : la suite géométrique converge vers **0**.`,
        en: `# Arithmetic and geometric sequences

- Arithmetic: **uₙ = u₀ + n·r**
- Geometric: **uₙ = u₀ · qⁿ**
- If |q| < 1, a geometric sequence converges to 0.`,
      },
    },
  ],
  questions: [
    {
      key: "q1",
      type: "numeric",
      difficulty: 1,
      prompt: {
        fr: "(uₙ) est arithmétique avec u₀ = 3 et r = 4. Calculer u₁₀.",
        en: "(uₙ) is arithmetic with u₀ = 3 and r = 4. Find u₁₀.",
      },
      numeric: [43, 0],
      explanation: { fr: "u₁₀ = 3 + 10 × 4 = 43.", en: "u₁₀ = 3 + 10 × 4 = 43." },
    },
    {
      key: "q2",
      type: "numeric",
      difficulty: 2,
      prompt: {
        fr: "(vₙ) est géométrique avec v₀ = 2 et q = 3. Calculer v₄.",
        en: "(vₙ) is geometric with v₀ = 2 and q = 3. Find v₄.",
      },
      numeric: [162, 0],
      explanation: { fr: "v₄ = 2 × 3⁴ = 162.", en: "v₄ = 2 × 3⁴ = 162." },
    },
    {
      key: "q3",
      type: "single_choice",
      difficulty: 2,
      prompt: {
        fr: "Une suite géométrique de raison q = 0,5 et de premier terme 8 :",
        en: "A geometric sequence with q = 0.5 and first term 8:",
      },
      options: [
        ["Converges to 0", "Converge vers 0", true],
        ["Converges to 8", "Converge vers 8"],
        ["Diverges to +∞", "Diverge vers +∞"],
        ["Converges to 16", "Converge vers 16"],
      ],
      explanation: { fr: "|q| < 1 donc qⁿ → 0 et vₙ → 0.", en: "|q| < 1 so qⁿ → 0." },
    },
  ],
};

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------

const probaSciences: [string, number][] = [
  ["mathematics", 4],
  ["physics", 2],
  ["chemistry", 2],
  ["biology", 2],
  ["french", 2],
  ["english-language", 2],
];

export const exams: SeedExam[] = [
  {
    slug: "cm-gce-o-level",
    program: { kind: "grades", grades: ["A", "B", "C", "D", "E", "U"], passGrades: ["A", "B", "C"], minSubjects: 4, maxSubjects: 11 },
    name: { en: "GCE Ordinary Level", fr: "GCE Ordinary Level" },
    description: {
      en: "Cameroon GCE O Level (Anglophone subsystem). Candidates sit individual subjects graded A–E.",
      fr: "GCE O Level du Cameroun (sous-système anglophone).",
    },
    level: "secondary",
    primaryLanguage: "en",
    tracks: [
      {
        slug: "general",
        name: { en: "General", fr: "Général" },
        subjects: [
          ["mathematics", 1],
          ["english-language", 1],
          ["physics", 1],
          ["chemistry", 1],
          ["biology", 1],
          ["history", 1],
          ["geography", 1],
          ["economics", 1],
          ["french", 1],
        ],
        chapters: [quadratics, kinematics],
      },
    ],
  },
  {
    slug: "cm-gce-a-level",
    program: { kind: "grades", grades: ["A", "B", "C", "D", "E", "O", "F"], passGrades: ["A", "B", "C", "D", "E"], minSubjects: 2, maxSubjects: 5 },
    name: { en: "GCE Advanced Level", fr: "GCE Advanced Level" },
    description: {
      en: "Cameroon GCE A Level (Anglophone subsystem), taken at the end of high school.",
      fr: "GCE A Level du Cameroun (sous-système anglophone).",
    },
    level: "upper-secondary",
    primaryLanguage: "en",
    tracks: [
      {
        slug: "science",
        name: { en: "Science", fr: "Sciences" },
        subjects: [
          ["mathematics", 1],
          ["physics", 1],
          ["chemistry", 1],
          ["biology", 1],
          ["computer-science", 1],
        ],
        chapters: [differentiation, moles],
      },
      {
        slug: "arts",
        name: { en: "Arts", fr: "Lettres" },
        subjects: [
          ["literature", 1],
          ["history", 1],
          ["economics", 1],
          ["geography", 1],
          ["french", 1],
        ],
        chapters: [],
      },
    ],
  },
  {
    slug: "cm-probatoire",
    program: FRENCH_AVERAGE,
    name: { fr: "Probatoire", en: "Probatoire" },
    description: {
      fr: "Examen de fin de Première (sous-système francophone), prérequis pour la Terminale.",
      en: "End of Première exam (Francophone subsystem), required to enter Terminale.",
    },
    level: "secondary",
    primaryLanguage: "fr",
    tracks: [
      {
        slug: "serie-c",
        name: { fr: "Série C", en: "Series C" },
        subjects: [["mathematics", 6], ["physics", 3], ["chemistry", 2], ["biology", 2], ["french", 2], ["english-language", 2]],
        chapters: [trinome, travail],
      },
      { slug: "serie-d", name: { fr: "Série D", en: "Series D" }, subjects: probaSciences, chapters: [] },
      {
        slug: "serie-a4",
        name: { fr: "Série A4", en: "Series A4" },
        subjects: [["french", 4], ["history", 2], ["geography", 2], ["english-language", 3], ["mathematics", 1]],
        chapters: [],
      },
    ],
  },
  {
    slug: "cm-bac",
    program: FRENCH_AVERAGE,
    name: { fr: "Baccalauréat", en: "Baccalaureate" },
    description: {
      fr: "Examen de fin d'études secondaires (sous-système francophone).",
      en: "End of secondary school exam (Francophone subsystem).",
    },
    level: "upper-secondary",
    primaryLanguage: "fr",
    tracks: [
      {
        slug: "serie-c",
        name: { fr: "Série C", en: "Series C" },
        subjects: [["mathematics", 7], ["physics", 4], ["chemistry", 2], ["biology", 2], ["philosophy", 2], ["french", 2], ["english-language", 2]],
        chapters: [suites],
      },
      {
        slug: "serie-d",
        name: { fr: "Série D", en: "Series D" },
        subjects: [["mathematics", 4], ["biology", 5], ["physics", 3], ["chemistry", 2], ["philosophy", 2], ["french", 2], ["english-language", 2]],
        chapters: [complexes, mendel],
      },
      {
        slug: "serie-a4",
        name: { fr: "Série A4", en: "Series A4" },
        subjects: [["philosophy", 5], ["french", 4], ["history", 2], ["geography", 2], ["english-language", 3], ["mathematics", 1]],
        chapters: [],
      },
    ],
  },
];
