// Fixed, hand-validated fixtures for the bias-detector prototype demo.
// These mirror the exact shape the real orchestrator (:5050 /api/analyze) returns
// — findings[] from the 3 detectors, a debate transcript, and a judge verdict —
// so the UI is faithful without needing Ollama running. Each example is curated
// and checked by hand so the demo is 100% reproducible.
//
// Response shape (per example.result):
//   { input, normalized:{source,url?,title?,textPreview},
//     findings:[ {bias,detected,severity,evidence[],explanation,baseline?} ],
//     debate:{ transcript:[ {round:"advocates",entries:[{bias,statement}]},
//                           {round:"skeptic",content}, {round:"rebuttal",content} ] },
//     verdict:{ perBias:[{bias,finalSeverity,note}], overallVerdict, rationale } }

export const BIAS_AXES = ["omission", "framing", "fear"];

export const EXAMPLES = [
  // ── 1. Biased news URL ────────────────────────────────────────────────────
  {
    id: "url-biased",
    kind: "url",
    label: "Biased news article (URL)",
    input: "https://dailywire-example.com/migrant-crime-wave-shock",
    blurb: "A local-news scare piece on crime. Heavy fear + framing, key context omitted.",
    result: {
      input: "https://dailywire-example.com/migrant-crime-wave-shock",
      normalized: {
        source: "url",
        url: "https://dailywire-example.com/migrant-crime-wave-shock",
        title: "SHOCK: Migrant Crime Wave Terrorizes Quiet Town — Residents Fear for Their Children",
        textPreview:
          "A terrifying surge of violent crime is sweeping through the once-peaceful town of " +
          "Riverside after a wave of migrants arrived last spring. Terrified parents now say " +
          "they are too afraid to let their children walk to school. \"It's only a matter of " +
          "time before someone is killed,\" one resident warned. Officials refuse to act before " +
          "it's too late. Every family in America should be asking: are you next?",
      },
      findings: [
        {
          bias: "omission",
          detected: true,
          severity: 8,
          evidence: [
            "a wave of migrants arrived last spring",
            "A terrifying surge of violent crime is sweeping through",
          ],
          explanation:
            "The article asserts a causal link between migrant arrivals and crime while omitting " +
            "all baseline statistics: no actual crime figures, no year-over-year comparison, and no " +
            "mention that town police data show violent crime flat or declining. It also omits any " +
            "migrant or expert voice, presenting only one side.",
        },
        {
          bias: "framing",
          detected: true,
          severity: 7,
          evidence: [
            "SHOCK: Migrant Crime Wave Terrorizes Quiet Town",
            "once-peaceful town",
            "Officials refuse to act",
          ],
          explanation:
            "Loaded framing throughout: 'SHOCK', 'crime wave', 'terrorizes', and 'once-peaceful' " +
            "cast migrants as invaders and the town as a victim. 'Officials refuse to act' frames " +
            "inaction as willful, presuming a threat the piece never substantiates.",
          baseline: {
            detected: true,
            explanation: "The text seems emotionally charged and one-sided.",
          },
        },
        {
          bias: "fear",
          detected: true,
          severity: 9,
          evidence: [
            "Terrified parents now say they are too afraid to let their children walk to school",
            "It's only a matter of time before someone is killed",
            "before it's too late",
            "are you next?",
          ],
          explanation:
            "Textbook fear appeal: manufactured urgency ('before it's too late'), catastrophizing a " +
            "worst case ('only a matter of time before someone is killed') as inevitable, appeals to " +
            "the safety of children, and a direct second-person threat ('are you next?') to provoke " +
            "dread rather than inform.",
          baseline: {
            detected: true,
            explanation: "This text uses scary language.",
          },
        },
      ],
      debate: {
        transcript: [
          {
            round: "advocates",
            entries: [
              {
                bias: "omission",
                statement:
                  "OMISSION (detected=true, severity=8): A causal claim with zero supporting data — " +
                  "no crime figures, no trend line, no opposing voice.",
              },
              {
                bias: "framing",
                statement:
                  "FRAMING (detected=true, severity=7): 'SHOCK', 'crime wave', 'terrorizes' frame a " +
                  "group as an invading threat before any evidence is offered.",
              },
              {
                bias: "fear",
                statement:
                  "FEAR (detected=true, severity=9): Urgency, child-safety appeals, and a direct " +
                  "'are you next?' threat engineer dread.",
              },
            ],
          },
          {
            round: "skeptic",
            content:
              "OMISSION: Fair — but a short news brief can't cite every statistic; is the missing data " +
              "truly load-bearing? Yes, here it is, since the entire thesis is causal. Concede the point.\n\n" +
              "FRAMING: 'Once-peaceful' could be ordinary color writing. However, stacked with 'SHOCK' and " +
              "'crime wave' the cumulative effect is clearly slanted, not incidental.\n\n" +
              "FEAR: A real safety concern isn't automatically manipulation. But 'are you next?' addresses a " +
              "reader with no connection to the town — that is provocation, not information. Severity stands.",
          },
          {
            round: "rebuttal",
            content:
              "OMISSION: We hold firm — the causal claim is the story, so omitting the numbers is the core flaw.\n\n" +
              "FRAMING: We concede a single loaded word would be weak; our case rests on the pattern, which is strong.\n\n" +
              "FEAR: Agreed the underlying topic is legitimate; our finding is about the technique used to present " +
              "it, which remains manipulative.",
          },
        ],
      },
      verdict: {
        perBias: [
          { bias: "omission", finalSeverity: 8, note: "Causal claim advanced with no supporting data or counter-voice." },
          { bias: "framing", finalSeverity: 7, note: "Consistent invader/victim framing precedes any evidence." },
          { bias: "fear", finalSeverity: 9, note: "Urgency + child-safety + direct threat; clear fear appeal." },
        ],
        overallVerdict: "biased",
        rationale:
          "All three detectors agree and survived skeptical challenge. The piece makes an unsupported causal " +
          "claim (omission), wraps it in invader/victim language (framing), and drives it home with manufactured " +
          "urgency and a personal threat (fear). This is a strongly biased text.",
      },
    },
  },

  // ── 2. Neutral news URL ───────────────────────────────────────────────────
  {
    id: "url-neutral",
    kind: "url",
    label: "Neutral report (URL)",
    input: "https://apnews-example.com/city-council-transit-budget",
    blurb: "A straight council-budget report. Attributed, quantified, both sides quoted.",
    result: {
      input: "https://apnews-example.com/city-council-transit-budget",
      normalized: {
        source: "url",
        url: "https://apnews-example.com/city-council-transit-budget",
        title: "City Council Approves $4.2M Transit Budget After Public Comment",
        textPreview:
          "The city council voted 5-2 on Tuesday to approve a $4.2 million transit budget for the " +
          "coming fiscal year, a 3% increase over last year. Councilmember Ruiz, who voted yes, said " +
          "the funds would extend two bus routes. Councilmember Adler, who voted no, said the increase " +
          "was unaffordable given the projected deficit. A transit-union representative supported the " +
          "measure; a taxpayer group opposed it. The budget takes effect July 1.",
      },
      findings: [
        {
          bias: "omission",
          detected: false,
          severity: 1,
          evidence: [],
          explanation:
            "The report attributes the vote count, the dollar figure, the percentage change, and quotes " +
            "both a supporting and an opposing councilmember plus outside groups on each side. No obvious " +
            "material context is withheld.",
        },
        {
          bias: "framing",
          detected: false,
          severity: 1,
          evidence: [],
          explanation:
            "Language is descriptive and neutral ('voted 5-2', 'a 3% increase', 'takes effect July 1'). " +
            "No loaded adjectives or slanted characterizations of either side.",
          baseline: {
            detected: false,
            explanation: "The text appears factual and balanced.",
          },
        },
        {
          bias: "fear",
          detected: false,
          severity: 0,
          evidence: [],
          explanation:
            "No threat language, urgency, or emotional appeals. 'Unaffordable given the projected deficit' " +
            "is an attributed policy argument, not a scare tactic.",
          baseline: {
            detected: false,
            explanation: "No emotionally manipulative language detected.",
          },
        },
      ],
      debate: {
        transcript: [
          {
            round: "advocates",
            entries: [
              { bias: "omission", statement: "OMISSION (detected=false, severity=1): Both sides quoted; figures attributed." },
              { bias: "framing", statement: "FRAMING (detected=false, severity=1): Neutral, descriptive language." },
              { bias: "fear", statement: "FEAR (detected=false, severity=0): No emotional appeals present." },
            ],
          },
          {
            round: "skeptic",
            content:
              "OMISSION: I looked for a buried omission — none found; the deficit context is even included.\n\n" +
              "FRAMING: 'Unaffordable' is a strong word, but it is quoted from a named councilmember, so it is " +
              "reported speech, not the outlet's framing.\n\n" +
              "FEAR: Nothing to challenge. The detectors are correct to find this clean.",
          },
          {
            round: "rebuttal",
            content:
              "OMISSION: No change — we agree the reporting is complete.\n\n" +
              "FRAMING: We accept the skeptic's point; attributing 'unaffordable' is proper journalism.\n\n" +
              "FEAR: Nothing to add.",
          },
        ],
      },
      verdict: {
        perBias: [
          { bias: "omission", finalSeverity: 1, note: "Balanced sourcing; no material context withheld." },
          { bias: "framing", finalSeverity: 1, note: "Descriptive, non-loaded language throughout." },
          { bias: "fear", finalSeverity: 0, note: "No emotional or threat language." },
        ],
        overallVerdict: "neutral",
        rationale:
          "The report attributes its facts, quantifies its claims, and quotes both supporters and opponents. " +
          "No detector found a real bias and the skeptic confirmed the text is clean. This is neutral reporting.",
      },
    },
  },

  // ── 3. Biased raw prompt ──────────────────────────────────────────────────
  {
    id: "prompt-biased",
    kind: "prompt",
    label: "Biased text (pasted prompt)",
    input:
      "They don't want you to know the truth. Time is running out to save our country from the " +
      "radical elites who are destroying everything you love. Act now before it's too late — your " +
      "family's future depends on it.",
    blurb: "Campaign-style copy. Conspiratorial omission, us-vs-them framing, heavy fear.",
    result: {
      input:
        "They don't want you to know the truth. Time is running out to save our country from the " +
        "radical elites who are destroying everything you love. Act now before it's too late — your " +
        "family's future depends on it.",
      normalized: {
        source: "prompt",
        textPreview:
          "They don't want you to know the truth. Time is running out to save our country from the " +
          "radical elites who are destroying everything you love. Act now before it's too late — your " +
          "family's future depends on it.",
      },
      findings: [
        {
          bias: "omission",
          detected: true,
          severity: 6,
          evidence: ["They don't want you to know the truth", "the radical elites"],
          explanation:
            "Gestures at a hidden 'truth' and a villain ('the radical elites') without naming who, what, or " +
            "any verifiable fact. The concrete substance is entirely omitted, leaving only insinuation.",
        },
        {
          bias: "framing",
          detected: true,
          severity: 7,
          evidence: [
            "save our country from the radical elites",
            "destroying everything you love",
          ],
          explanation:
            "Pure us-vs-them framing: a virtuous 'our country' and 'you' set against 'radical elites' who are " +
            "'destroying everything you love'. The framing manufactures a total moral conflict from vague terms.",
          baseline: {
            detected: true,
            explanation: "The text is highly emotional and one-sided.",
          },
        },
        {
          bias: "fear",
          detected: true,
          severity: 8,
          evidence: [
            "Time is running out",
            "Act now before it's too late",
            "your family's future depends on it",
          ],
          explanation:
            "Stacked fear techniques: manufactured urgency ('time is running out', 'act now before it's too " +
            "late') and an appeal to the safety of one's family, engineered to pressure action rather than inform.",
          baseline: {
            detected: true,
            explanation: "This is fear-based persuasive language.",
          },
        },
      ],
      debate: {
        transcript: [
          {
            round: "advocates",
            entries: [
              { bias: "omission", statement: "OMISSION (detected=true, severity=6): A hidden 'truth' and a villain, no specifics." },
              { bias: "framing", statement: "FRAMING (detected=true, severity=7): Total us-vs-them moral conflict from vague terms." },
              { bias: "fear", statement: "FEAR (detected=true, severity=8): Urgency plus family-safety appeal to force action." },
            ],
          },
          {
            round: "skeptic",
            content:
              "OMISSION: This is rhetoric, not reporting — should we expect citations? For a claim this sweeping, " +
              "the absence of any referent is itself the tell. Concede.\n\n" +
              "FRAMING: 'Elites' is common political shorthand; is it truly loaded? Combined with 'destroying " +
              "everything you love' the framing is unmistakably adversarial. Stands.\n\n" +
              "FEAR: The urgency is undeniable; nothing to push back on here.",
          },
          {
            round: "rebuttal",
            content:
              "OMISSION: We hold — the vagueness is deliberate and central.\n\n" +
              "FRAMING: Agreed the pattern, not one word, carries our case.\n\n" +
              "FEAR: No change; the technique is textbook.",
          },
        ],
      },
      verdict: {
        perBias: [
          { bias: "omission", finalSeverity: 6, note: "Insinuates a hidden truth and villain with zero specifics." },
          { bias: "framing", finalSeverity: 7, note: "Absolute us-vs-them moral framing from vague terms." },
          { bias: "fear", finalSeverity: 8, note: "Urgency + family-safety appeal to pressure action." },
        ],
        overallVerdict: "biased",
        rationale:
          "Short but saturated: it omits all substance behind an insinuated 'truth', frames a total us-vs-them " +
          "conflict, and applies urgent family-safety fear pressure. All three findings held under challenge. " +
          "Clearly biased persuasion.",
      },
    },
  },

  // ── 4. Neutral raw prompt ─────────────────────────────────────────────────
  {
    id: "prompt-neutral",
    kind: "prompt",
    label: "Neutral text (pasted prompt)",
    input:
      "The study, published Tuesday in Nature, followed 1,200 participants over five years. " +
      "Researchers reported a 12% reduction in the measured outcome, and noted the sample was " +
      "limited to one region. Two independent experts said the results were promising but should " +
      "be replicated.",
    blurb: "A summary of a study. Quantified, hedged, limitations and outside experts noted.",
    result: {
      input:
        "The study, published Tuesday in Nature, followed 1,200 participants over five years. " +
        "Researchers reported a 12% reduction in the measured outcome, and noted the sample was " +
        "limited to one region. Two independent experts said the results were promising but should " +
        "be replicated.",
      normalized: {
        source: "prompt",
        textPreview:
          "The study, published Tuesday in Nature, followed 1,200 participants over five years. " +
          "Researchers reported a 12% reduction in the measured outcome, and noted the sample was " +
          "limited to one region. Two independent experts said the results were promising but should " +
          "be replicated.",
      },
      findings: [
        {
          bias: "omission",
          detected: false,
          severity: 1,
          evidence: [],
          explanation:
            "The text volunteers its own limitation (sample 'limited to one region') and includes outside " +
            "expert caveats ('should be replicated'). Sample size, duration, and effect size are all given. " +
            "No material context appears withheld.",
        },
        {
          bias: "framing",
          detected: false,
          severity: 0,
          evidence: [],
          explanation:
            "Neutral, quantified language: '1,200 participants', 'over five years', 'a 12% reduction'. No " +
            "loaded adjectives or slanted characterization.",
          baseline: {
            detected: false,
            explanation: "The text reads as a factual summary.",
          },
        },
        {
          bias: "fear",
          detected: false,
          severity: 0,
          evidence: [],
          explanation:
            "No urgency, threat, or emotional appeal. 'Promising but should be replicated' is measured, hedged " +
            "language — the opposite of a fear appeal.",
          baseline: {
            detected: false,
            explanation: "No emotional manipulation detected.",
          },
        },
      ],
      debate: {
        transcript: [
          {
            round: "advocates",
            entries: [
              { bias: "omission", statement: "OMISSION (detected=false, severity=1): Limitations and caveats stated up front." },
              { bias: "framing", statement: "FRAMING (detected=false, severity=0): Quantified, neutral language." },
              { bias: "fear", statement: "FEAR (detected=false, severity=0): Measured, hedged tone." },
            ],
          },
          {
            round: "skeptic",
            content:
              "OMISSION: I checked whether funding source or conflicts were hidden — the text is a short summary and " +
              "nothing load-bearing is missing for its scope. Agree.\n\n" +
              "FRAMING: 'Promising' is mildly positive, but it is attributed to independent experts and immediately " +
              "hedged. Not the author's framing. Agree.\n\n" +
              "FEAR: Nothing to challenge.",
          },
          {
            round: "rebuttal",
            content:
              "OMISSION: No change — reporting is appropriately complete.\n\n" +
              "FRAMING: We accept the attribution point.\n\n" +
              "FEAR: Nothing to add.",
          },
        ],
      },
      verdict: {
        perBias: [
          { bias: "omission", finalSeverity: 1, note: "Volunteers its own limitations and expert caveats." },
          { bias: "framing", finalSeverity: 0, note: "Quantified, non-loaded language." },
          { bias: "fear", finalSeverity: 0, note: "Measured and hedged; no appeals." },
        ],
        overallVerdict: "neutral",
        rationale:
          "The summary quantifies its claims, discloses its own sample limitation, and attributes hedged caveats " +
          "to independent experts. No detector found bias and the skeptic agreed. Neutral, responsible reporting.",
      },
    },
  },
];
