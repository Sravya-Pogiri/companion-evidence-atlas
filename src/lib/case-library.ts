// The three public-record cases from the landing page, generated from public/landing/script.js
// by a script, not retyped. Facts, timelines and contradictions come from the linked public
// sources (National Registry of Exonerations, Equal Justice Initiative, the Supreme Court
// opinion); the wording is the landing page's own. Findings are suggestions for attorney review.

export interface SourceRef {
  label: string;
  url: string;
}
export interface FindingSide {
  label: string;
  text: string;
  cite: string;
}
export interface CaseFinding {
  title: string;
  explanation: string;
  sides: FindingSide[];
}
export interface CaseEvidence {
  name: string;
  desc: string;
  icon: string;
}
export interface PublicCase {
  id: string;
  name: string;
  category: string;
  location: string;
  type: string;
  overview: string;
  summary: string;
  focus: string;
  facts: [string, string][];
  issues: string[];
  questions: string[];
  timeline: { date: string; text: string }[];
  timelineSource: SourceRef;
  evidence: CaseEvidence[];
  primarySource: SourceRef;
  sources: SourceRef[];
  findings: CaseFinding[];
  checklistTitle: string | null;
  checklist: string[];
  note: string | null;
}

export const PUBLIC_CASES: PublicCase[] = [
  {
    id: "benitez",
    name: "Ricardo Benitez",
    category: "Eyewitness Identification & Surveillance",
    location: "Queens, New York",
    type: "Robbery",
    overview:
      "Convicted of a 2009 armed robbery in Queens largely on a store clerk's identification. Security video showed the robbery lasted about a minute. He was acquitted at a 2015 retrial.",
    summary:
      "Mr. Benitez was convicted of robbing a Radio Shack on Rockaway Beach Boulevard and sentenced to 22 years to life. The robber had worn sunglasses and a hoodie. The case rested mainly on the clerk's identification, which came after she said she later recognized the man in a passing car. An appellate court reversed the conviction in 2014. At the 2015 retrial, expert and factual testimony challenged the identification, and the jury acquitted him.",
    focus: "Testimony versus surveillance video",
    facts: [
      ["Crime date", "June 24, 2009"],
      ["Conviction", "October 19, 2010"],
      ["Sentence", "22 years to life"],
      ["Reversal", "August 2014 (Appellate Division)"],
      ["Acquittal at retrial", "March 11, 2015"],
      ["Time in custody", "Nearly six years"],
    ],
    issues: [
      "Disputed eyewitness identification.",
      "Potential inconsistencies between witness recollection and surveillance footage.",
      "Questions concerning the reliability of identification procedures.",
    ],
    questions: [
      "According to the security video, how long could the clerk see the robber's face? How does that compare with her trial testimony?",
      "How might the sunglasses, the hoodie, the gun and a cross-racial identification have affected the reliability of the identification?",
      "How did the clerk's description change between her first report and her later testimony?",
      "Were the photo array and lineup fillers similar to the suspect in age and appearance?",
      "Can the anonymous tip's source be identified, or is it untestable hearsay?",
      "Does independent information, such as signal timing, support the account of the later sighting?",
    ],
    timeline: [
      {
        date: "Jun 24, 2009",
        text: "A man in sunglasses and a hoodie robs a Radio Shack on Rockaway Beach Boulevard at gunpoint and takes about $300.",
      },
      {
        date: "Jun 25, 2009",
        text: "The clerk views mug shots on a police computer and cannot identify anyone. She says the sunglasses and hoodie hid the robber's face.",
      },
      {
        date: "~1 week later",
        text: "The clerk says she recognized the robber in a car stopped at a red light. The next day she picks Mr. Benitez's photo from a photo array.",
      },
      {
        date: "After arrest",
        text: "She identifies him again at a live lineup. According to the Registry, the other lineup participants were about 20 years younger and white. Mr. Benitez is Hispanic.",
      },
      {
        date: "Aug 2010",
        text: "At a suppression hearing, the prosecution concedes the lineup was unduly suggestive. The court still allows an in-court identification.",
      },
      {
        date: "Oct 19, 2010",
        text: "A jury convicts him of armed robbery. He is sentenced to 22 years to life.",
      },
      {
        date: "Aug 2014",
        text: "The Appellate Division reverses the conviction. It holds that the prosecutor's closing reference to an anonymous tip was improper.",
      },
      {
        date: "Mar 11, 2015",
        text: "At retrial, an eyewitness memory expert and a city official on traffic-signal timing testify for the defense. The jury acquits, and he is released after nearly six years in custody.",
      },
    ],
    timelineSource: {
      label: "National Registry of Exonerations — Ricardo Benitez",
      url: "https://exonerationregistry.org/cases/12219",
    },
    evidence: [
      {
        name: "Eyewitness identification procedures",
        desc: "Mug-shot review, photo array, live lineup and in-court identification.",
        icon: "eye",
      },
      {
        name: "Store security video",
        desc: "Showed the incident lasted about one minute, according to the Registry summary.",
        icon: "video",
      },
      {
        name: "Anonymous tip testimony",
        desc: "A detective's account of a tip about a man named “Rick.” The appeal centered on how it was used.",
        icon: "mic",
      },
      {
        name: "Expert testimony on eyewitness memory",
        desc: "Given at retrial on factors such as cross-racial identification, a visible weapon, a disguise and brief exposure.",
        icon: "users",
      },
      {
        name: "Traffic-signal timing",
        desc: "Given at retrial: the light changes in under a minute.",
        icon: "clock",
      },
    ],
    primarySource: {
      label: "National Registry of Exonerations — Ricardo Benitez",
      url: "https://exonerationregistry.org/cases/12219",
    },
    sources: [
      {
        label: "National Registry of Exonerations — Ricardo Benitez",
        url: "https://exonerationregistry.org/cases/12219",
      },
    ],
    findings: [
      {
        title: "Potential inconsistency: observation duration.",
        explanation:
          "The two sources disagree about how long the witness could see the robber. Flagged for attorney review.",
        sides: [
          {
            label: "Witness testimony",
            text: "Testified she looked at the robber's face for several minutes.",
            cite: "Per NRE case summary",
          },
          {
            label: "Security video",
            text: "Incident lasted about one minute. The clerk faced the robber for only a few seconds.",
            cite: "Per NRE case summary",
          },
        ],
      },
      {
        title: "Potential inconsistency: sighting conditions.",
        explanation:
          "The account of the later recognition conflicts with independent signal-timing information.",
        sides: [
          {
            label: "Witness account",
            text: "Said she watched the man in a car at a red light for five minutes.",
            cite: "Per NRE case summary",
          },
          {
            label: "Retrial testimony",
            text: "A city official testified the light changes in under a minute.",
            cite: "Per NRE case summary",
          },
        ],
      },
    ],
    checklistTitle: null,
    checklist: [],
    note: "In a real deployment, each finding would cite a transcript page or a video timestamp. Here, the citations point to the Registry's public summary because CaseLens has not processed the original records.",
  },
  {
    id: "mcmillian",
    name: "Walter McMillian",
    category: "Witness Testimony & Disclosure",
    location: "Monroeville, Alabama",
    type: "Murder",
    overview:
      "Sentenced to death for the 1986 murder of Ronda Morrison, even though dozens of people said he was at a church fish fry. His conviction was overturned in 1993 after evidence emerged that state witnesses had been coerced.",
    summary:
      "Ronda Morrison, 18, was murdered in 1986 at the dry cleaning store where she worked in downtown Monroeville. Months later, investigators focused on Walter McMillian after a man facing charges in another county accused him falsely. He was held on death row before trial and convicted after a trial lasting a day and a half. The jury chose life without parole, and the judge overrode it with a death sentence. The Equal Justice Initiative later found that state witnesses had been coerced and that the prosecution had suppressed exculpatory evidence. The Alabama Court of Criminal Appeals overturned the conviction in 1993.",
    focus: "Contradictory witness accounts and disclosure",
    facts: [
      ["Crime", "1986, Monroeville, Alabama"],
      ["Pretrial detention", "15 months on death row before trial"],
      ["Trial length", "A day and a half"],
      ["Sentence", "Death (judicial override of jury's life verdict)"],
      ["Conviction overturned", "1993, Alabama Court of Criminal Appeals"],
      ["Released", "March 1993, after six years on death row"],
    ],
    issues: [
      "Contradictory witness accounts.",
      "Evidence potentially undermining the prosecution's timeline.",
      "Exculpatory evidence and disclosure concerns.",
    ],
    questions: [
      "Do the State's witnesses agree with each other on time, place and sequence of events?",
      "How does the State's timeline compare with the alibi witnesses' accounts of the fish fry?",
      "Do recorded interviews show a witness's account changing over time, or pressure to change it?",
      "Have all recorded statements, interview notes and investigative files been disclosed?",
      "Do any pending charges, incentives or agreements affect a witness's credibility?",
    ],
    timeline: [
      {
        date: "1986",
        text: "Ronda Morrison, an 18-year-old clerk, is murdered at a dry cleaning store in downtown Monroeville, Alabama.",
      },
      {
        date: "~6 months later",
        text: "With no leads, investigators turn to Mr. McMillian after a man facing charges in another county makes false statements accusing him.",
      },
      {
        date: "Before trial",
        text: "Under an arrangement made by the sheriff, he is placed on Alabama's death row before trial. He spends 15 months there awaiting trial.",
      },
      {
        date: "Trial",
        text: "The trial lasts a day and a half. Three state witnesses testify against him, while Black alibi witnesses say he was at a church fish fry. The jury convicts and chooses life without parole.",
      },
      {
        date: "Sentencing",
        text: "Judge Robert E. Lee Key overrides the jury and sentences him to death.",
      },
      {
        date: "Post-conviction",
        text: "EJI uncovers evidence that state witnesses were coerced. This includes tape recordings showing the State's only eyewitness was pressured to testify falsely, and evidence that the prosecution suppressed exculpatory material.",
      },
      {
        date: "1993",
        text: "The Alabama Court of Criminal Appeals rules his conviction unconstitutional. The Alabama Bureau of Investigation confirms his innocence, and prosecutors agree to drop the charges.",
      },
      {
        date: "March 1993",
        text: "Mr. McMillian is released from death row after six years. He died in September 2013.",
      },
    ],
    timelineSource: {
      label: "Equal Justice Initiative — Walter McMillian",
      url: "https://eji.org/cases/walter-mcmillian/",
    },
    evidence: [
      {
        name: "State witness testimony",
        desc: "Three witnesses for the State. EJI later documented coercion.",
        icon: "users",
      },
      {
        name: "Alibi witness accounts",
        desc: "Many people said he was at a church fish fry when the crime occurred.",
        icon: "list",
      },
      {
        name: "Recorded witness interviews",
        desc: "Tape recordings later showed the State's only eyewitness had been pressured.",
        icon: "mic",
      },
      {
        name: "Suppressed exculpatory evidence",
        desc: "Evidence favorable to the defense that the prosecution did not disclose.",
        icon: "file",
      },
      {
        name: "Independent state investigation",
        desc: "The Alabama Bureau of Investigation later confirmed EJI's findings.",
        icon: "search",
      },
    ],
    primarySource: {
      label: "Equal Justice Initiative — Walter McMillian",
      url: "https://eji.org/cases/walter-mcmillian/",
    },
    sources: [
      {
        label: "Equal Justice Initiative — Walter McMillian",
        url: "https://eji.org/cases/walter-mcmillian/",
      },
      {
        label: "National Registry of Exonerations — search the Registry",
        url: "https://exonerationregistry.org/",
      },
    ],
    findings: [
      {
        title: "Conflicting accounts for the same period.",
        explanation:
          "The sources cannot all be accurate. CaseLens would group them on one timeline and flag the conflict for attorney review. It would not resolve the conflict itself.",
        sides: [
          {
            label: "Prosecution",
            text: "State witnesses place Mr. McMillian at the scene of the crime.",
            cite: "Per EJI case summary",
          },
          {
            label: "Defense alibi",
            text: "Many witnesses place him at a church fish fry at the same time.",
            cite: "Per EJI case summary",
          },
          {
            label: "Recordings",
            text: "Taped statements indicate pressure on the State's only eyewitness.",
            cite: "Per EJI case summary",
          },
        ],
      },
    ],
    checklistTitle: "Illustrative evidence-request checklist",
    checklist: [
      "All recorded interviews with each prosecution witness",
      "Interview notes and reports for every prosecution witness",
      "Records of any agreements, leniency or consideration given to witnesses",
      "Statements taken from alibi witnesses during the investigation",
      "Records of other suspects or leads investigated",
    ],
    note: "These are generic disclosure categories that a defense team might request. They are not a claim about which specific documents existed in this case.",
  },
  {
    id: "hinton",
    name: "Anthony Ray Hinton",
    category: "Forensic Evidence Analysis",
    location: "Birmingham area, Alabama",
    type: "Murder",
    overview:
      "Sentenced to death for two 1985 murders on the strength of a claimed firearms match. Independent experts found the bullets could not be matched to the gun. He was released in 2015 after 30 years on death row.",
    summary:
      "In 1985, John Davidson and Thomas Wayne Vason, managers of Birmingham-area fast-food restaurants, were killed in two robberies. There were no eyewitnesses and no fingerprint evidence. After a manager wounded in a third robbery picked Mr. Hinton from a photo lineup, State examiners said his mother's revolver had fired the bullets in all three crimes. The prosecutor told the court that this asserted match was the only evidence linking him to the murders. His defense relied on an expert without firearms identification expertise. In 2014 the U.S. Supreme Court unanimously found that his trial lawyer had been constitutionally deficient.",
    focus: "Conflicting forensic conclusions",
    facts: [
      ["Crimes", "1985, Birmingham area"],
      ["Key evidence", "Claimed firearms match to his mother's revolver"],
      ["Sentence", "Death"],
      ["U.S. Supreme Court", "February 24, 2014 (unanimous)"],
      ["Released", "April 3, 2015"],
      ["Time on death row", "30 years"],
    ],
    issues: [
      "Disputed firearms identification evidence.",
      "Conflicting forensic conclusions.",
      "Questions about the reliability of expert testimony.",
    ],
    questions: [
      "What methods and documentation support the State examiners' conclusion that the bullets matched the revolver?",
      "Do bench notes, photographs and test-fire records support how strongly that conclusion was stated at trial?",
      "Is the defense expert qualified in firearms identification, and is funding sufficient to retain one who is?",
      "Do independent re-examinations reach the same conclusion? If not, why not?",
      "Can work or access records corroborate the alibi for the Bessemer robbery?",
    ],
    timeline: [
      {
        date: "1985",
        text: "Two Birmingham-area restaurant managers, John Davidson and Thomas Wayne Vason, are killed in separate robberies.",
      },
      {
        date: "Jul 25, 1985",
        text: "A Bessemer restaurant is robbed and its manager is wounded. He picks Mr. Hinton from a photo lineup. EJI reports that Mr. Hinton was working in a locked warehouse 15 miles away at the time.",
      },
      {
        date: "Investigation",
        text: "Police seize an old revolver belonging to his mother. State firearms examiners say it was used in all three crimes.",
      },
      {
        date: "Trial",
        text: "Defense counsel wrongly believes he cannot get enough funding for a qualified firearms examiner. He hires an expert without firearms-identification expertise. Mr. Hinton is convicted and sentenced to death, and a polygraph favorable to him is not admitted.",
      },
      {
        date: "2002",
        text: "Three highly qualified firearms examiners, including a former chief of the FBI's firearms and toolmarks unit, testify. They find the bullets cannot be matched to a single gun, and that the revolver could not have fired the bullets from the Bessemer robbery.",
      },
      {
        date: "Feb 24, 2014",
        text: "The U.S. Supreme Court unanimously holds that his trial lawyer was constitutionally deficient.",
      },
      {
        date: "After remand",
        text: "A new trial is ordered. Alabama Department of Forensic Sciences scientists test the evidence and confirm the bullets cannot be matched to the Hinton weapon. The charges are dismissed.",
      },
      {
        date: "Apr 3, 2015",
        text: "Mr. Hinton walks out of the Jefferson County Jail a free man after 30 years on death row.",
      },
    ],
    timelineSource: {
      label: "Equal Justice Initiative — Anthony Ray Hinton",
      url: "https://eji.org/cases/anthony-ray-hinton/",
    },
    evidence: [
      {
        name: "Firearms / toolmark identification",
        desc: "The State's claim that the crime bullets matched a single revolver.",
        icon: "target",
      },
      {
        name: "Physical evidence: the revolver",
        desc: "An old revolver belonging to Mr. Hinton's mother, seized by police.",
        icon: "search",
      },
      {
        name: "Defense expert testimony",
        desc: "Given at trial by a witness without firearms-identification expertise.",
        icon: "flask",
      },
      {
        name: "Independent expert re-examination",
        desc: "Three qualified examiners (2002), followed by Alabama Department of Forensic Sciences testing.",
        icon: "users",
      },
      {
        name: "Photo-lineup identification",
        desc: "From the wounded manager in the uncharged Bessemer robbery.",
        icon: "eye",
      },
      {
        name: "Alibi: work location",
        desc: "EJI reports he was working in a locked warehouse during the Bessemer robbery.",
        icon: "clock",
      },
    ],
    primarySource: {
      label: "Equal Justice Initiative — Anthony Ray Hinton",
      url: "https://eji.org/cases/anthony-ray-hinton/",
    },
    sources: [
      {
        label: "Equal Justice Initiative — Anthony Ray Hinton",
        url: "https://eji.org/cases/anthony-ray-hinton/",
      },
      {
        label: "Hinton v. Alabama, 571 U.S. 263 (2014) — Justia",
        url: "https://supreme.justia.com/cases/federal/us/571/263/",
      },
      {
        label: "National Registry of Exonerations — search the Registry",
        url: "https://exonerationregistry.org/",
      },
    ],
    findings: [
      {
        title: "Conflicting forensic conclusions.",
        explanation:
          "Qualified experts reached opposite conclusions about the same physical evidence. Flagged for verification and possible expert consultation.",
        sides: [
          {
            label: "State examiners (trial)",
            text: "The revolver was used in all three crimes.",
            cite: "Per EJI case summary",
          },
          {
            label: "Independent examiners (2002)",
            text: "The bullets cannot be matched to a single gun. The revolver could not have fired the Bessemer bullets.",
            cite: "Per EJI case summary",
          },
        ],
      },
    ],
    checklistTitle: "Illustrative evidence verification checklist",
    checklist: [
      "Examiner qualifications and proficiency-testing records",
      "Bench notes, photographs and comparison images",
      "Test-fire records and the methodology used",
      "Chain-of-custody documentation for bullets and the firearm",
      "Request for independent re-examination by a qualified expert",
      "Request for funding to retain a qualified defense expert",
    ],
    note: "CaseLens does not evaluate forensic science itself. It is designed to put conflicting conclusions side by side, link each to its source, and prompt the right verification steps for attorneys and qualified experts.",
  },
];
