/* ==========================================================================
   Lexora — script.js
   Modules: data → helpers → nav → reveal/counters → cases + modal → workflow → calculator
   ========================================================================== */
(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const icon = (name, cls = "ico") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const ext = (href, label, cls = "") =>
    `<a href="${href}" target="_blank" rel="noopener" class="${cls}">${label}${icon("ext", "ico ico--xs")}<span class="sr-only"> (opens in a new tab)</span></a>`;

  /* ------------------------------------------------------------------------
     1. DATA
     Historical facts are drawn only from the linked public sources
     (National Registry of Exonerations, Equal Justice Initiative, U.S. Supreme Court).
     "Demo" content is explicitly illustrative and built from those public summaries,
     not from original case evidence.
     ------------------------------------------------------------------------ */
  const SRC = {
    nreBenitez: { label: "National Registry of Exonerations — Ricardo Benitez", url: "https://exonerationregistry.org/cases/12219" },
    nre: { label: "National Registry of Exonerations — search the Registry", url: "https://exonerationregistry.org/" },
    ejiMcMillian: { label: "Equal Justice Initiative — Walter McMillian", url: "https://eji.org/cases/walter-mcmillian/" },
    ejiHinton: { label: "Equal Justice Initiative — Anthony Ray Hinton", url: "https://eji.org/cases/anthony-ray-hinton/" },
    scotusHinton: { label: "Hinton v. Alabama, 571 U.S. 263 (2014) — Justia", url: "https://supreme.justia.com/cases/federal/us/571/263/" },
    rosalesOpinion: { label: "Rosales v. Lewis, No. 25-30650 (5th Cir.) — opinion", url: "https://www.govinfo.gov/content/pkg/USCOURTS-ca5-25-30650/pdf/USCOURTS-ca5-25-30650-0.pdf" },
    rosalesComplaint: { label: "Complaint, No. 1:22-cv-5838 (W.D. La.) — Institute for Justice", url: "https://ij.org/wp-content/uploads/2022/10/LA-Rosales-Traffic-Stop-Complaint.pdf" },
    rosalesDashcam: { label: "Patrol dashcam video (public)", url: "https://www.youtube.com/watch?v=xqvFJ8yzDfw" },
    rosalesBodycam: { label: "Officer bodycam video (public)", url: "https://www.youtube.com/watch?v=Z6z35SUVpdQ" },
    btkState: { label: "State's Summary of the Evidence, State v. Rader (2005)", url: "https://murderpedia.org/male.R/images/rader_dennis/docs/doc-46.pdf" },
    btkRcfl: { label: "FBI RCFL Annual Report, FY2005", url: "https://www.rcfl.gov/file-repository/rcfl_nat_annual05.pdf" },
    btkPlea: { label: "Transcript of pleas of guilty, 05 CR 498", url: "https://murderpedia.org/male.R/images/rader_dennis/rader-testimony.pdf" },
    btkChurch: { label: "Christ Lutheran Church page, archived Feb 6, 2005 — Internet Archive", url: "https://web.archive.org/web/20050206044729/http://www.christ-lutheran.org/people/" },
    btkValadez: { label: "Valadez v. Emmis Communications, No. 99139 (Kan.)", url: "https://kscourts.gov/KSCourts/media/KsCourts/Opinions/99139.pdf?ext=.pdf" }
  };

  const CASES = [
    // The two cases the app investigates (case 1 and case 2 in the book). Facts come from the
    // public filings, videos and evidence packet the app analyzes.
    {
      id: "rosales",
      name: "Rosales v. Terrell",
      category: "Traffic Stop · Video & Filings",
      location: "Alexandria, Louisiana",
      type: "Civil rights (traffic stop)",
      art: "video",
      overview:
        "In June 2022, Alexandria police pulled over Mario Rosales's Mustang after a left turn. The officers gave failure to signal as the reason; the complaint says the video shows he signaled, and the Fifth Circuit says the video does not make clear when the signal came on.",
      focus: "The stated reason for the stop versus the video and the filings.",
      capability: "Video, transcript and filings on one timeline, with contradiction checks",
      primarySource: SRC.rosalesOpinion,
      summary:
        "Mario Rosales and Gracie Lasyone sued Officers Jim Lewis and Samuel Terrell and the City of Alexandria over the stop (W.D. La. No. 1:22-cv-5838). The officers appealed the denial of their motion for judgment on the pleadings to the Fifth Circuit, asserting qualified immunity (No. 25-30650). Public dashcam and bodycam video of the stop are linked.",
      facts: [
        ["Stop", "June 2022, around 5:00 p.m."],
        ["Place", "Alexandria, Louisiana"],
        ["District court", "W.D. La. No. 1:22-cv-5838"],
        ["Appeal", "5th Cir. No. 25-30650"],
        ["Stated reason", "Failure to signal"],
        ["Video", "Public dashcam and bodycam"]
      ],
      issues: [
        "Whether the left turn signal was on before the turn, and for how long.",
        "The officers' stated reason for the stop against what the video shows.",
        "The passenger's request to record the stop."
      ],
      timeline: [
        { date: "Jun 2022", text: "Rosales signals left and stops at a red light; a police vehicle stops behind him and pulls the Mustang over after the turn (opinion, p.2)." },
        { date: "Dashcam 1:34", text: "An officer stands at the Mustang's open driver-side door." },
        { date: "Bodycam 5:30", text: "An officer gives failure to signal as the reason for the stop." },
        { date: "Bodycam 8:00", text: "“That's straight pure straight honest answer. He failed the signal, so we stopped you.”" },
        { date: "Bodycam 18:46", text: "The officer issues citations for failure to signal and registration." },
        { date: "2022", text: "Rosales and Lasyone file a civil-rights complaint in the Western District of Louisiana." },
        { date: "Later", text: "The traffic citations are dismissed (complaint ¶238; opinion, p.5)." },
        { date: "Appeal", text: "The officers appeal the denial of their motion for judgment on the pleadings to the Fifth Circuit." }
      ],
      timelineSource: SRC.rosalesOpinion,
      evidence: [
        { icon: "video", name: "Patrol dashcam", desc: "The approach, the turn and the stop, on the dashcam's own clock." },
        { icon: "video", name: "Officer bodycam", desc: "The roadside stop after the turn, about 21 minutes." },
        { icon: "mic", name: "Bodycam transcript", desc: "What the officers said, with the times of cited lines re-checked." },
        { icon: "file", name: "Complaint", desc: "The plaintiffs' account, paragraph by paragraph (40 pages)." },
        { icon: "file", name: "Fifth Circuit opinion", desc: "The court's description of the stop and the video (24 pages)." },
        { icon: "search", name: "Dispatch audio", desc: "Dispatch radioed history-check results, but no recording is in the record." }
      ],
      questions: [
        "When was the left turn signal activated, and was it on for the distance the law requires before the turn?",
        "Where does the officer's stated reason sit against what the dashcam shows?",
        "What does the bodycam show about the passenger's request to record?",
        "Is there a dispatch recording of the stop, and what time does it give?",
        "The two videos run on separate clocks: what links a dashcam moment to a bodycam moment?"
      ],
      demo: {
        type: "contradiction",
        title: "Cross-source contradiction detection",
        pairs: [
          {
            a: { k: "Officer, bodycam 8:00", v: "“He failed the signal, so we stopped you.”", cite: "Bodycam transcript" },
            b: { k: "Fifth Circuit, p.11", v: "The video shows the officers pull behind the Mustang as it approached the intersection, with the left turn signal appearing already on.", cite: "Opinion p.11" },
            flag: "<b>Possible conflict: the stated reason.</b> The reason given on the recording and the court's description of the video point different ways. Flagged for attorney review."
          },
          {
            a: { k: "Complaint ¶250", v: "Says the video shows Rosales signaled his turn.", cite: "Complaint p.31" },
            b: { k: "Fifth Circuit, p.11", v: "“It is not clear from the video when Rosales activated the signal.”", cite: "Opinion p.11" },
            flag: "<b>Possible conflict: what the video settles.</b> The complaint and the court describe the same video differently."
          }
        ],
        note: "In the app, each finding links to its page or video moment, and every quote is checked against the stored record."
      },
      sources: [SRC.rosalesOpinion, SRC.rosalesComplaint, SRC.rosalesDashcam, SRC.rosalesBodycam]
    },
    {
      id: "btk",
      name: "State v. Rader (BTK)",
      category: "Digital Forensics & Public Record",
      location: "Sedgwick County, Kansas",
      type: "Homicide (ten counts)",
      art: "network",
      overview:
        "A floppy disk mailed to a Wichita TV station in February 2005 carried the words “Dennis” and “Christ Lutheran Church” in its file properties, a lead that pointed investigators to Dennis Rader. DNA comparisons followed, and he pleaded guilty to ten counts in June 2005.",
      focus: "A digital lead traced through dated records.",
      capability: "Dated records, verified quotes and an attribution test without the disk lead",
      primarySource: SRC.btkState,
      summary:
        "In State of Kansas v. Dennis L. Rader (05 CR 498, Sedgwick County), the prosecution's evidence summary describes how a diskette mailed to KSAS-TV led to a church listing naming Rader, followed by DNA comparisons, an arrest and a recorded interview. The court accepted his guilty pleas on June 27, 2005 and imposed ten consecutive life sentences.",
      facts: [
        ["Case", "05 CR 498, Sedgwick County"],
        ["Church page archived", "Feb 6, 2005"],
        ["Disk received by KSAS", "Feb 16, 2005"],
        ["Arrest", "Feb 25, 2005"],
        ["Pleas accepted", "Jun 27, 2005"],
        ["Sentence", "Ten consecutive life terms"]
      ],
      issues: [
        "How the disk information was found: document properties, or a deleted file?",
        "Which DNA comparison answered which question: case links, a family reference, or Rader's own swabs.",
        "Records not in the public packet: the disk image, signed lab reports, custody logs."
      ],
      timeline: [
        { date: "Mar 19, 2004", text: "The Wichita Eagle passes renewed correspondence to police." },
        { date: "Dec 6, 2004", text: "An FBI Lab report finds no detectable DNA on the tested flap of envelope Q184." },
        { date: "Feb 6, 2005", text: "The Internet Archive captures the church page listing Dennis Rader as congregation president." },
        { date: "Feb 16, 2005", text: "KSAS-TV receives a padded envelope with a purple computer disk." },
        { date: "Feb 22, 2005", text: "KBI receives a court-authorized family reference sample." },
        { date: "Feb 25, 2005", text: "Rader is arrested; police collect oral swabs and begin a recorded interview." },
        { date: "Feb 26, 2005", text: "Police announce the arrest at a press conference." },
        { date: "Jun 27, 2005", text: "The court accepts guilty pleas on all ten counts." },
        { date: "Aug 18, 2005", text: "The court imposes ten consecutive life sentences." }
      ],
      timelineSource: SRC.btkState,
      evidence: [
        { icon: "search", name: "Floppy disk and its file", desc: "One file, “Test A.RTF”, whose properties named “Dennis” and “Christ Lutheran Church”." },
        { icon: "list", name: "Archived church page", desc: "Internet Archive capture of Feb 6, 2005 listing the congregation council officers." },
        { icon: "flask", name: "DNA comparisons", desc: "County, KBI and FBI laboratory work as described in the State's filing and the FBI release." },
        { icon: "video", name: "Store surveillance", desc: "A dark SUV; the person was reported unidentifiable." },
        { icon: "mic", name: "Recorded interview", desc: "Described in the State's filing; a published excerpt exists." },
        { icon: "file", name: "Court record", desc: "Complaint, plea transcript, judgment and evidence order." }
      ],
      questions: [
        "Where on the disk did the words come from: the document's properties, or a deleted file?",
        "Which links to Rader remain if the disk lead is set aside?",
        "Which records would let the digital examination be repeated: the disk image, the file's bytes, the examiner's notes?",
        "What did each DNA comparison test, and are the signed lab reports available?",
        "Did the store video identify the driver, or only a type of vehicle?"
      ],
      demo: {
        type: "contradiction",
        title: "Cross-source comparison",
        pairs: [
          {
            a: { k: "State's Summary, p.42", v: "Found “Dennis” and “Christ Lutheran Church” in the properties section of the document.", cite: "State filing p.42" },
            b: { k: "FBI RCFL report, p.13", v: "Examination of the disk properties revealed the words “Dennis” and “Christ Lutheran Church”.", cite: "RCFL p.13" },
            flag: "<b>Sources agree, worded differently.</b> Both name the same words; one says document properties, the other disk properties."
          },
          {
            a: { k: "TV report (KSN)", v: "The police chief himself took part in the arrest.", cite: "As recorded by the Kansas Supreme Court" },
            b: { k: "Kansas Supreme Court, p.5", v: "“The police chief was not, in fact, at the scene of the arrest.”", cite: "Valadez opinion p.5" },
            flag: "<b>A report contradicted by the record.</b> The State's list of the arrest team does not name him either."
          }
        ],
        note: "In the app, every quote is checked against the stored page of the record it cites."
      },
      sources: [SRC.btkState, SRC.btkRcfl, SRC.btkPlea, SRC.btkChurch, SRC.btkValadez]
    },
    {
      id: "benitez",
      name: "Ricardo Benitez",
      category: "Eyewitness Identification & Surveillance",
      location: "Queens, New York",
      type: "Robbery",
      art: "video",
      overview:
        "Convicted of a 2009 armed robbery in Queens largely on a store clerk's identification. Security video showed the robbery lasted about a minute. He was acquitted at a 2015 retrial.",
      focus: "Testimony versus surveillance video",
      capability: "Cross-source contradiction detection and timeline comparison",
      primarySource: SRC.nreBenitez,
      summary:
        "Mr. Benitez was convicted of robbing a Radio Shack on Rockaway Beach Boulevard and sentenced to 22 years to life. The robber had worn sunglasses and a hoodie. The case rested mainly on the clerk's identification, which came after she said she later recognized the man in a passing car. An appellate court reversed the conviction in 2014. At the 2015 retrial, expert and factual testimony challenged the identification, and the jury acquitted him.",
      facts: [
        ["Crime date", "June 24, 2009"],
        ["Conviction", "October 19, 2010"],
        ["Sentence", "22 years to life"],
        ["Reversal", "August 2014 (Appellate Division)"],
        ["Acquittal at retrial", "March 11, 2015"],
        ["Time in custody", "Nearly six years"]
      ],
      issues: [
        "Disputed eyewitness identification.",
        "Potential inconsistencies between witness recollection and surveillance footage.",
        "Questions concerning the reliability of identification procedures."
      ],
      timeline: [
        { date: "Jun 24, 2009", text: "A man in sunglasses and a hoodie robs a Radio Shack on Rockaway Beach Boulevard at gunpoint and takes about $300." },
        { date: "Jun 25, 2009", text: "The clerk views mug shots on a police computer and cannot identify anyone. She says the sunglasses and hoodie hid the robber's face." },
        { date: "~1 week later", text: "The clerk says she recognized the robber in a car stopped at a red light. The next day she picks Mr. Benitez's photo from a photo array." },
        { date: "After arrest", text: "She identifies him again at a live lineup. According to the Registry, the other lineup participants were about 20 years younger and white. Mr. Benitez is Hispanic." },
        { date: "Aug 2010", text: "At a suppression hearing, the prosecution concedes the lineup was unduly suggestive. The court still allows an in-court identification." },
        { date: "Oct 19, 2010", text: "A jury convicts him of armed robbery. He is sentenced to 22 years to life." },
        { date: "Aug 2014", text: "The Appellate Division reverses the conviction. It holds that the prosecutor's closing reference to an anonymous tip was improper." },
        { date: "Mar 11, 2015", text: "At retrial, an eyewitness memory expert and a city official on traffic-signal timing testify for the defense. The jury acquits, and he is released after nearly six years in custody." }
      ],
      timelineSource: SRC.nreBenitez,
      evidence: [
        { icon: "eye", name: "Eyewitness identification procedures", desc: "Mug-shot review, photo array, live lineup and in-court identification." },
        { icon: "video", name: "Store security video", desc: "Showed the incident lasted about one minute, according to the Registry summary." },
        { icon: "mic", name: "Anonymous tip testimony", desc: "A detective's account of a tip about a man named “Rick.” The appeal centered on how it was used." },
        { icon: "users", name: "Expert testimony on eyewitness memory", desc: "Given at retrial on factors such as cross-racial identification, a visible weapon, a disguise and brief exposure." },
        { icon: "clock", name: "Traffic-signal timing", desc: "Given at retrial: the light changes in under a minute." }
      ],
      questions: [
        "According to the security video, how long could the clerk see the robber's face? How does that compare with her trial testimony?",
        "How might the sunglasses, the hoodie, the gun and a cross-racial identification have affected the reliability of the identification?",
        "How did the clerk's description change between her first report and her later testimony?",
        "Were the photo array and lineup fillers similar to the suspect in age and appearance?",
        "Can the anonymous tip's source be identified, or is it untestable hearsay?",
        "Does independent information, such as signal timing, support the account of the later sighting?"
      ],
      demo: {
        type: "contradiction",
        title: "Cross-source contradiction detection",
        pairs: [
          {
            a: { k: "Witness testimony", v: "Testified she looked at the robber's face for several minutes.", cite: "Per NRE case summary" },
            b: { k: "Security video", v: "Incident lasted about one minute. The clerk faced the robber for only a few seconds.", cite: "Per NRE case summary" },
            flag: "<b>Potential inconsistency: observation duration.</b> The two sources disagree about how long the witness could see the robber. Flagged for attorney review."
          },
          {
            a: { k: "Witness account", v: "Said she watched the man in a car at a red light for five minutes.", cite: "Per NRE case summary" },
            b: { k: "Retrial testimony", v: "A city official testified the light changes in under a minute.", cite: "Per NRE case summary" },
            flag: "<b>Potential inconsistency: sighting conditions.</b> The account of the later recognition conflicts with independent signal-timing information."
          }
        ],
        note: "In a real deployment, each finding would cite a transcript page or a video timestamp. Here, the citations point to the Registry's public summary because Lexora has not processed the original records."
      },
      sources: [SRC.nreBenitez]
    },
    {
      id: "mcmillian",
      name: "Walter McMillian",
      category: "Witness Testimony & Disclosure",
      location: "Monroeville, Alabama",
      type: "Murder",
      art: "network",
      overview:
        "Sentenced to death for the 1986 murder of Ronda Morrison, even though dozens of people said he was at a church fish fry. His conviction was overturned in 1993 after evidence emerged that state witnesses had been coerced.",
      focus: "Contradictory witness accounts and disclosure",
      capability: "Timeline reconstruction, evidence relationships and missing-document identification",
      primarySource: SRC.ejiMcMillian,
      summary:
        "Ronda Morrison, 18, was murdered in 1986 at the dry cleaning store where she worked in downtown Monroeville. Months later, investigators focused on Walter McMillian after a man facing charges in another county accused him falsely. He was held on death row before trial and convicted after a trial lasting a day and a half. The jury chose life without parole, and the judge overrode it with a death sentence. The Equal Justice Initiative later found that state witnesses had been coerced and that the prosecution had suppressed exculpatory evidence. The Alabama Court of Criminal Appeals overturned the conviction in 1993.",
      facts: [
        ["Crime", "1986, Monroeville, Alabama"],
        ["Pretrial detention", "15 months on death row before trial"],
        ["Trial length", "A day and a half"],
        ["Sentence", "Death (judicial override of jury's life verdict)"],
        ["Conviction overturned", "1993, Alabama Court of Criminal Appeals"],
        ["Released", "March 1993, after six years on death row"]
      ],
      issues: [
        "Contradictory witness accounts.",
        "Evidence potentially undermining the prosecution's timeline.",
        "Exculpatory evidence and disclosure concerns."
      ],
      timeline: [
        { date: "1986", text: "Ronda Morrison, an 18-year-old clerk, is murdered at a dry cleaning store in downtown Monroeville, Alabama." },
        { date: "~6 months later", text: "With no leads, investigators turn to Mr. McMillian after a man facing charges in another county makes false statements accusing him." },
        { date: "Before trial", text: "Under an arrangement made by the sheriff, he is placed on Alabama's death row before trial. He spends 15 months there awaiting trial." },
        { date: "Trial", text: "The trial lasts a day and a half. Three state witnesses testify against him, while Black alibi witnesses say he was at a church fish fry. The jury convicts and chooses life without parole." },
        { date: "Sentencing", text: "Judge Robert E. Lee Key overrides the jury and sentences him to death." },
        { date: "Post-conviction", text: "EJI uncovers evidence that state witnesses were coerced. This includes tape recordings showing the State's only eyewitness was pressured to testify falsely, and evidence that the prosecution suppressed exculpatory material." },
        { date: "1993", text: "The Alabama Court of Criminal Appeals rules his conviction unconstitutional. The Alabama Bureau of Investigation confirms his innocence, and prosecutors agree to drop the charges." },
        { date: "March 1993", text: "Mr. McMillian is released from death row after six years. He died in September 2013." }
      ],
      timelineSource: SRC.ejiMcMillian,
      evidence: [
        { icon: "users", name: "State witness testimony", desc: "Three witnesses for the State. EJI later documented coercion." },
        { icon: "list", name: "Alibi witness accounts", desc: "Many people said he was at a church fish fry when the crime occurred." },
        { icon: "mic", name: "Recorded witness interviews", desc: "Tape recordings later showed the State's only eyewitness had been pressured." },
        { icon: "file", name: "Suppressed exculpatory evidence", desc: "Evidence favorable to the defense that the prosecution did not disclose." },
        { icon: "search", name: "Independent state investigation", desc: "The Alabama Bureau of Investigation later confirmed EJI's findings." }
      ],
      questions: [
        "Do the State's witnesses agree with each other on time, place and sequence of events?",
        "How does the State's timeline compare with the alibi witnesses' accounts of the fish fry?",
        "Do recorded interviews show a witness's account changing over time, or pressure to change it?",
        "Have all recorded statements, interview notes and investigative files been disclosed?",
        "Do any pending charges, incentives or agreements affect a witness's credibility?"
      ],
      demo: {
        type: "timeline",
        title: "Timeline reconstruction & missing-document identification",
        rows: [
          { t: "Prosecution", v: "State witnesses place Mr. McMillian at the scene of the crime." },
          { t: "Defense alibi", v: "Many witnesses place him at a church fish fry at the same time.", flag: true },
          { t: "Recordings", v: "Taped statements indicate pressure on the State's only eyewitness.", flag: true }
        ],
        flag: "<b>Conflicting accounts for the same period.</b> The sources cannot all be accurate. Lexora would group them on one timeline and flag the conflict for attorney review. It would not resolve the conflict itself.",
        checklistTitle: "Illustrative evidence-request checklist",
        checklist: [
          "All recorded interviews with each prosecution witness",
          "Interview notes and reports for every prosecution witness",
          "Records of any agreements, leniency or consideration given to witnesses",
          "Statements taken from alibi witnesses during the investigation",
          "Records of other suspects or leads investigated"
        ],
        note: "These are generic disclosure categories that a defense team might request. They are not a claim about which specific documents existed in this case."
      },
      sources: [SRC.ejiMcMillian, SRC.nre]
    },
    {
      id: "hinton",
      name: "Anthony Ray Hinton",
      category: "Forensic Evidence Analysis",
      location: "Birmingham area, Alabama",
      type: "Murder",
      art: "forensic",
      overview:
        "Sentenced to death for two 1985 murders on the strength of a claimed firearms match. Independent experts found the bullets could not be matched to the gun. He was released in 2015 after 30 years on death row.",
      focus: "Conflicting forensic conclusions",
      capability: "Comparing forensic conclusions and generating an evidence verification checklist",
      primarySource: SRC.ejiHinton,
      summary:
        "In 1985, John Davidson and Thomas Wayne Vason, managers of Birmingham-area fast-food restaurants, were killed in two robberies. There were no eyewitnesses and no fingerprint evidence. After a manager wounded in a third robbery picked Mr. Hinton from a photo lineup, State examiners said his mother's revolver had fired the bullets in all three crimes. The prosecutor told the court that this asserted match was the only evidence linking him to the murders. His defense relied on an expert without firearms identification expertise. In 2014 the U.S. Supreme Court unanimously found that his trial lawyer had been constitutionally deficient.",
      facts: [
        ["Crimes", "1985, Birmingham area"],
        ["Key evidence", "Claimed firearms match to his mother's revolver"],
        ["Sentence", "Death"],
        ["U.S. Supreme Court", "February 24, 2014 (unanimous)"],
        ["Released", "April 3, 2015"],
        ["Time on death row", "30 years"]
      ],
      issues: [
        "Disputed firearms identification evidence.",
        "Conflicting forensic conclusions.",
        "Questions about the reliability of expert testimony."
      ],
      timeline: [
        { date: "1985", text: "Two Birmingham-area restaurant managers, John Davidson and Thomas Wayne Vason, are killed in separate robberies." },
        { date: "Jul 25, 1985", text: "A Bessemer restaurant is robbed and its manager is wounded. He picks Mr. Hinton from a photo lineup. EJI reports that Mr. Hinton was working in a locked warehouse 15 miles away at the time." },
        { date: "Investigation", text: "Police seize an old revolver belonging to his mother. State firearms examiners say it was used in all three crimes." },
        { date: "Trial", text: "Defense counsel wrongly believes he cannot get enough funding for a qualified firearms examiner. He hires an expert without firearms-identification expertise. Mr. Hinton is convicted and sentenced to death, and a polygraph favorable to him is not admitted." },
        { date: "2002", text: "Three highly qualified firearms examiners, including a former chief of the FBI's firearms and toolmarks unit, testify. They find the bullets cannot be matched to a single gun, and that the revolver could not have fired the bullets from the Bessemer robbery." },
        { date: "Feb 24, 2014", text: "The U.S. Supreme Court unanimously holds that his trial lawyer was constitutionally deficient." },
        { date: "After remand", text: "A new trial is ordered. Alabama Department of Forensic Sciences scientists test the evidence and confirm the bullets cannot be matched to the Hinton weapon. The charges are dismissed." },
        { date: "Apr 3, 2015", text: "Mr. Hinton walks out of the Jefferson County Jail a free man after 30 years on death row." }
      ],
      timelineSource: SRC.ejiHinton,
      evidence: [
        { icon: "target", name: "Firearms / toolmark identification", desc: "The State's claim that the crime bullets matched a single revolver." },
        { icon: "search", name: "Physical evidence: the revolver", desc: "An old revolver belonging to Mr. Hinton's mother, seized by police." },
        { icon: "flask", name: "Defense expert testimony", desc: "Given at trial by a witness without firearms-identification expertise." },
        { icon: "users", name: "Independent expert re-examination", desc: "Three qualified examiners (2002), followed by Alabama Department of Forensic Sciences testing." },
        { icon: "eye", name: "Photo-lineup identification", desc: "From the wounded manager in the uncharged Bessemer robbery." },
        { icon: "clock", name: "Alibi: work location", desc: "EJI reports he was working in a locked warehouse during the Bessemer robbery." }
      ],
      questions: [
        "What methods and documentation support the State examiners' conclusion that the bullets matched the revolver?",
        "Do bench notes, photographs and test-fire records support how strongly that conclusion was stated at trial?",
        "Is the defense expert qualified in firearms identification, and is funding sufficient to retain one who is?",
        "Do independent re-examinations reach the same conclusion? If not, why not?",
        "Can work or access records corroborate the alibi for the Bessemer robbery?"
      ],
      demo: {
        type: "forensic",
        title: "Forensic conclusion comparison & verification checklist",
        pairs: [
          {
            a: { k: "State examiners (trial)", v: "The revolver was used in all three crimes.", cite: "Per EJI case summary" },
            b: { k: "Independent examiners (2002)", v: "The bullets cannot be matched to a single gun. The revolver could not have fired the Bessemer bullets.", cite: "Per EJI case summary" },
            flag: "<b>Conflicting forensic conclusions.</b> Qualified experts reached opposite conclusions about the same physical evidence. Flagged for verification and possible expert consultation."
          }
        ],
        checklistTitle: "Illustrative evidence verification checklist",
        checklist: [
          "Examiner qualifications and proficiency-testing records",
          "Bench notes, photographs and comparison images",
          "Test-fire records and the methodology used",
          "Chain-of-custody documentation for bullets and the firearm",
          "Request for independent re-examination by a qualified expert",
          "Request for funding to retain a qualified defense expert"
        ],
        note: "Lexora does not evaluate forensic science itself. It is designed to put conflicting conclusions side by side, link each to its source, and prompt the right verification steps for attorneys and qualified experts."
      },
      sources: [SRC.ejiHinton, SRC.scotusHinton, SRC.nre]
    }
  ];


  /* ------------------------------------------------------------------------
     2. NAVIGATION — sticky state, mobile menu, active section, progress
     ------------------------------------------------------------------------ */
  function initNav() {
    const header = $("#siteHeader");
    const toggle = $("#navToggle");
    const mobile = $("#mobileNav");
    const progress = $("#scrollProgress");
    const navLinks = $$("[data-nav]");
    // Sections in document order, each mapped to the nav item it activates.
    const order = [
      ["home", "home"], ["problem", "problem"], ["cases", "cases"]
    ].map(([id, nav]) => ({ el: document.getElementById(id), nav })).filter(o => o.el);

    const setMenu = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      toggle.querySelector("use").setAttribute("href", open ? "#i-x" : "#i-menu");
      mobile.hidden = !open;
      header.classList.toggle("is-scrolled", open || window.scrollY > 8);
    };
    toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
    $$("a", mobile).forEach(a => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !mobile.hidden) { setMenu(false); toggle.focus(); }
    });
    window.matchMedia("(min-width: 1241px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      if (mobile.hidden) header.classList.toggle("is-scrolled", y > 8);

      const probe = y + window.innerHeight * 0.35;
      let current = "home";
      for (const o of order) if (o.el.offsetTop <= probe) current = o.nav;
      if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) current = "impact";
      navLinks.forEach(a => {
        const on = a.dataset.nav === current;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ------------------------------------------------------------------------
     3. REVEALS & COUNTERS
     ------------------------------------------------------------------------ */
  function initReveal() {
    const items = $$(".reveal");
    if (prefersReducedMotion.matches || !("IntersectionObserver" in window)) {
      items.forEach(el => el.classList.add("is-visible"));
      return;
    }
    // Stagger siblings that share a parent
    const groups = new Map();
    items.forEach(el => {
      const p = el.parentElement;
      const i = groups.get(p) || 0;
      el.style.setProperty("--d", `${Math.min(i, 6) * 0.07}s`);
      groups.set(p, i + 1);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(el => io.observe(el));
  }

  const fmt = new Intl.NumberFormat("en-US");
  function animateNumber(el, to, { duration = 1400, format = (n) => fmt.format(Math.round(n)), from = 0 } = {}) {
    if (prefersReducedMotion.matches) { el.textContent = format(to); return; }
    if (el._raf) cancelAnimationFrame(el._raf);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = format(from + (to - from) * eased);
      if (t < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  }

  function initCounters() {
    const els = $$("[data-count]");
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        animateNumber(e.target, Number(e.target.dataset.count));
        io.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    els.forEach(el => io.observe(el));
  }

  /* ------------------------------------------------------------------------
     4. CASE CARDS
     ------------------------------------------------------------------------ */
  const cardArt = {
    video: `<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="#4F8CFF" stroke-opacity=".5"><rect x="230" y="26" width="130" height="80" rx="8"/><path d="M285 54l22 12-22 12z" fill="#4F8CFF" fill-opacity=".5"/></g>
      <path d="M40 112h320" stroke="#2A3F73"/><rect x="40" y="110" width="70" height="4" rx="2" fill="#4F8CFF"/>
      <circle cx="110" cy="112" r="6" fill="#0B1736" stroke="#9EC0FF" stroke-width="2"/>
      <g fill="none" stroke="#F5C76B" stroke-opacity=".7" stroke-dasharray="3 4"><path d="M110 112V60h120"/></g>
      <circle cx="140" cy="60" r="18" fill="none" stroke="#9EC0FF" stroke-opacity=".5"/><circle cx="140" cy="60" r="6" fill="#9EC0FF" fill-opacity=".6"/>
    </svg>`,
    network: `<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="#4F8CFF" stroke-opacity=".45"><path d="M200 74L120 40M200 74L110 110M200 74L290 36M200 74L300 104M200 74L250 128M290 36L330 70M300 104L330 70"/></g>
      <g fill="none" stroke="#F5C76B" stroke-opacity=".7" stroke-dasharray="3 4"><path d="M120 40L110 110"/></g>
      <circle cx="200" cy="74" r="14" fill="#2457E7" stroke="#9EC0FF"/>
      <g fill="#0B1736" stroke="#4F8CFF" stroke-width="1.5"><circle cx="120" cy="40" r="8"/><circle cx="110" cy="110" r="8"/><circle cx="290" cy="36" r="8"/><circle cx="300" cy="104" r="8"/><circle cx="250" cy="128" r="6"/><circle cx="330" cy="70" r="6"/></g>
    </svg>`,
    forensic: `<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="#4F8CFF" stroke-opacity=".55"><circle cx="150" cy="72" r="40"/><circle cx="270" cy="72" r="40"/><path d="M150 32v80M110 72h80M270 32v80M230 72h80" stroke-opacity=".25"/></g>
      <g fill="none" stroke="#9EC0FF" stroke-opacity=".7"><path d="M132 60l8 6-6 10 12 4M158 54l-4 14 10 8"/></g>
      <g fill="none" stroke="#9EC0FF" stroke-opacity=".7"><path d="M252 66l10-8 6 12 10-4M276 84l-8-6 12-6"/></g>
      <path d="M196 72h28" stroke="#F5C76B" stroke-dasharray="3 4"/><text x="210" y="62" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#F5C76B">≠</text>
    </svg>`
  };

  // The case archive on the landing page shows exactly these two cases, in this order.
  const ARCHIVE_FOCUS = {
    rosales: "The stated reason for the stop versus the video.",
    btk: "A digital lead traced through dated records."
  };
  const ARCHIVE = Object.keys(ARCHIVE_FOCUS).map(id => CASES.find(c => c.id === id));
  // "Open in the app": case 1 opens the app's Live Case page on Rosales v. Terrell, case 2 on
  // State v. Rader. The app's case dropdown still switches to any
  // case. Any other case opens its own page in the app.
  const APP_LINK = { rosales: "/live?case=rosales", btk: "/live?case=btk" };
  const appLink = (c) => APP_LINK[c.id] || `/live?case=${c.id}`;
  const firstSentence = (t) => (t.match(/^.*?[.!?](\s|$)/) || [t])[0].trim();

  function renderCases() {
    const root = $("#caseArchive");
    if (!root) return;
    root.innerHTML = ARCHIVE.map((c, i) => `
      <article class="cb-card" data-index="${i}" data-case="0${i + 1}" aria-labelledby="case-${c.id}-name">
        <div class="cb-card__sheet">
          <div class="cb-card__visual" aria-hidden="true">${cardArt[c.art]}</div>
          <p class="cb-card__k"><span class="cb-card__no">Case 0${i + 1}</span><span class="tag tag--fact">Historical fact</span></p>
          <h3 class="cb-card__name" id="case-${c.id}-name">${c.name}</h3>
          <p class="cb-card__meta">${c.location} · ${c.type}</p>
          <p class="cb-card__sum">${firstSentence(c.overview)}</p>
          <div class="cb-card__focus">
            <p>Investigative focus</p>
            <p>${ARCHIVE_FOCUS[c.id]}</p>
          </div>
          <div class="cb-card__actions">
            <button class="btn btn--primary btn--sm" data-open-case="${i}" aria-haspopup="dialog">View Case ${icon("arrow")}</button>
            <a class="cb-card__src cb-card__app" href="${appLink(c)}">Open in the app ${icon("arrow")}</a>
          </div>
        </div>
      </article>`).join("");

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open-case]");
      if (btn) Modal.open(Number(btn.dataset.openCase), btn);
    });
  }

  /* ------------------------------------------------------------------------
     5. CASE MODAL (native <dialog> + tabs)
     ------------------------------------------------------------------------ */
  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "timeline", label: "Timeline" },
    { id: "evidence", label: "Evidence" },
    { id: "questions", label: "Investigative Questions" },
    { id: "demo", label: "Lexora Demo" },
    { id: "sources", label: "Sources" }
  ];

  const Modal = {
    dialog: null, index: 0, trigger: null, tab: "overview",

    init() {
      this.dialog = $("#caseModal");
      this.tabsEl = $("#modalTabs");
      this.body = $("#modalBody");
      $("#modalClose").addEventListener("click", () => this.close());
      $("#modalPrev").addEventListener("click", () => this.go(-1));
      $("#modalNext").addEventListener("click", () => this.go(1));
      // Escape key — native "cancel" event; animate instead of instant close
      this.dialog.addEventListener("cancel", (e) => { e.preventDefault(); this.close(); });
      // Click on backdrop closes
      this.dialog.addEventListener("click", (e) => { if (e.target === this.dialog) this.close(); });
      this.tabsEl.addEventListener("click", (e) => {
        const b = e.target.closest("[role=tab]");
        if (b) this.selectTab(b.dataset.tab, true);
      });
      this.tabsEl.addEventListener("keydown", (e) => this.onTabKey(e));
      this.body.addEventListener("change", (e) => {
        if (e.target.matches(".checklist input")) this.updateChecklist();
      });
    },

    open(index, trigger) {
      this.index = index;
      this.trigger = trigger || document.activeElement;
      this.tab = "overview";
      this.render();
      document.body.classList.add("no-scroll");
      if (typeof this.dialog.showModal === "function") this.dialog.showModal();
      else this.dialog.setAttribute("open", "");
      this.body.scrollTop = 0;
      $("#modalClose").focus();
    },

    close() {
      if (!this.dialog.open) return;
      const finish = () => {
        this.dialog.classList.remove("is-closing");
        if (typeof this.dialog.close === "function") this.dialog.close(); else this.dialog.removeAttribute("open");
        document.body.classList.remove("no-scroll");
        if (this.trigger && document.contains(this.trigger)) this.trigger.focus();
      };
      if (prefersReducedMotion.matches) return finish();
      this.dialog.classList.add("is-closing");
      setTimeout(finish, 220);
    },

    go(dir) {
      this.index = (this.index + dir + ARCHIVE.length) % ARCHIVE.length;
      // Return focus to the newly shown case's card button on close
      this.trigger = $(`[data-open-case="${this.index}"]`) || this.trigger;
      this.render();
      this.body.scrollTop = 0;
    },

    render() {
      const c = ARCHIVE[this.index];
      $("#modalEyebrow").textContent = `Case 0${this.index + 1} of 0${ARCHIVE.length} · ${c.category}`;
      $("#modalTitle").textContent = c.name;
      $("#modalMeta").textContent = `${c.location} · ${c.type}`;
      $("#modalOpenApp").href = appLink(c);
      this.tabsEl.innerHTML = TABS.map(t => `
        <button role="tab" class="modal-tab" id="mtab-${t.id}" data-tab="${t.id}"
          aria-controls="mpanel" aria-selected="${t.id === this.tab}" tabindex="${t.id === this.tab ? 0 : -1}">${t.label}</button>`).join("");
      this.renderPanel();
    },

    selectTab(id, focus = false) {
      this.tab = id;
      $$("[role=tab]", this.tabsEl).forEach(b => {
        const on = b.dataset.tab === id;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) { b.focus(); b.scrollIntoView({ block: "nearest", inline: "nearest" }); }
      });
      this.renderPanel();
      this.body.scrollTop = 0;
    },

    onTabKey(e) {
      const tabs = $$("[role=tab]", this.tabsEl);
      const i = tabs.findIndex(t => t.dataset.tab === this.tab);
      let n = null;
      if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") n = 0;
      else if (e.key === "End") n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); this.selectTab(tabs[n].dataset.tab, true); }
    },

    renderPanel() {
      const c = ARCHIVE[this.index];
      const html = this.panels[this.tab](c);
      this.body.innerHTML = `<div role="tabpanel" id="mpanel" aria-labelledby="mtab-${this.tab}" tabindex="0">${html}</div>`;
      if (this.tab === "demo") this.updateChecklist();
    },

    updateChecklist() {
      const boxes = $$(".checklist input", this.body);
      const out = $(".checklist__progress", this.body);
      if (out) out.textContent = `${boxes.filter(b => b.checked).length} of ${boxes.length} items reviewed`;
    },

    panels: {
      overview: (c) => `
        <div class="mp-head"><h3>Case overview</h3><span class="tag tag--fact">Historical fact</span></div>
        <p class="mp-lede">${c.summary}</p>
        <dl class="mp-grid">${c.facts.map(([k, v]) => `<div class="mp-fact"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        <p class="mp-sub">Key investigative issues</p>
        <ul class="mp-issues">${c.issues.map(i => `<li>${icon("search")}<span>${i}</span></li>`).join("")}</ul>
        <p class="mp-sub">Lexora demo capability</p>
        <p class="mp-lede">${c.capability}. <span class="tag tag--illus">Illustrative</span></p>`,

      timeline: (c) => `
        <div class="mp-head"><h3>Timeline of documented events</h3><span class="tag tag--fact">Historical fact</span></div>
        <ol class="tl">${c.timeline.map(e => `<li><span class="tl__date">${e.date}</span><span class="tl__text">${e.text}</span></li>`).join("")}</ol>
        <p class="fineprint">Source: ${ext(c.timelineSource.url, c.timelineSource.label)}. Where the source gives no exact date, events are labeled by stage.</p>`,

      evidence: (c) => `
        <div class="mp-head"><h3>Evidence categories</h3><span class="tag tag--fact">Documented in public sources</span></div>
        <p class="mp-lede" style="margin-bottom:20px">These are the kinds of evidence the public sources describe for this case. Lexora has not accessed or processed any original evidence files.</p>
        <div class="ev-grid">${c.evidence.map(ev => `<div class="ev">${icon(ev.icon)}<div><h4>${ev.name}</h4><p>${ev.desc}</p></div></div>`).join("")}</div>`,

      questions: (c) => `
        <div class="mp-head"><h3>Potential investigative questions</h3><span class="tag tag--illus">Illustrative</span></div>
        <p class="mp-lede" style="margin-bottom:20px">Questions like these show the kind of draft a defense team might review. They are not legal advice, and they are not findings about the case.</p>
        <ol class="q-list">${c.questions.map(q => `<li>${q}</li>`).join("")}</ol>`,

      demo: (c) => {
        const d = c.demo;
        const pairs = (d.pairs || []).map(p => `
          <div class="compare-pair">
            <div class="src-card"><p class="src-card__k">${p.a.k}</p><p class="src-card__v">${p.a.v}</p><p class="src-card__cite">${p.a.cite}</p></div>
            <div class="vs"><span>VS</span></div>
            <div class="src-card"><p class="src-card__k">${p.b.k}</p><p class="src-card__v">${p.b.v}</p><p class="src-card__cite">${p.b.cite}</p></div>
          </div>
          <div class="flag">${icon("alert")}<span>${p.flag}</span></div>`).join("");
        const rows = d.rows ? `<div class="mini-tl">${d.rows.map(r => `<div class="mini-tl__row ${r.flag ? "mini-tl__row--flag" : ""}"><span>${r.t}</span><span>${r.v}</span></div>`).join("")}</div><div class="flag">${icon("alert")}<span>${d.flag}</span></div>` : "";
        const list = d.checklist ? `
          <p class="mp-sub">${d.checklistTitle}</p>
          <div class="checklist">${d.checklist.map((item, i) => `<label><input type="checkbox" id="chk-${c.id}-${i}" /><span>${item}</span></label>`).join("")}</div>
          <p class="checklist__progress" aria-live="polite"></p>` : "";
        return `
          <div class="mp-head"><h3>${d.title}</h3><span class="tag tag--illus">${APP_LINK[c.id] ? "From Lexora's analysis" : "Illustrative demonstration"}</span></div>
          <div class="demo">
            <p class="demo__intro">${APP_LINK[c.id]
              ? "These comparisons come from Lexora's analysis of the original public records: the filings, the transcript and the case packet. Open the case in the app to see each source, with its quoted passage checked against the record."
              : "This is a mock-up of how Lexora is designed to present findings, built only from the public case summary. It is not output from processing the original evidence."}</p>
            <p class="demo__cap">Capability: ${c.capability}</p>
            ${pairs}${rows}${list}
          </div>
          <p class="fineprint">${d.note}</p>`;
      },

      sources: (c) => `
        <div class="mp-head"><h3>Public sources</h3></div>
        <p class="mp-lede" style="margin-bottom:20px">All historical facts in this case view come from the sources below. Read them for the full, authoritative account.</p>
        <div class="src-list">${c.sources.map(s => `
          <a href="${s.url}" target="_blank" rel="noopener"><span><b>${s.label}</b><small>${s.url}</small></span>${icon("ext")}<span class="sr-only"> (opens in a new tab)</span></a>`).join("")}</div>
        <p class="fineprint">Historical cases are presented for educational demonstration. Investigative examples are illustrative unless supported by linked primary evidence.</p>`
    }
  };


  /* ------------------------------------------------------------------------
     HERO EVIDENCE BOARD — connector lines between the cards, from their real
     positions (redrawn on resize), a staggered entrance, and hover highlights.
     ------------------------------------------------------------------------ */
  function initEvidenceBoard() {
    const wrap = $("#evBoardWrap"), board = $("#evBoard"), svg = $("#evLines");
    if (!wrap || !board || !svg) return;
    const LINKS = [
      ["complaint", "dashcam", "t-red"],
      ["dashcam", "opinion", "t-green"],
      ["complaint", "officer", "t-blue"],
      ["officer", "place", "t-blue"],
      ["bodycam", "officer", "t-blue"],
      ["complaint", "dispatch", "t-orange"],
      ["bodycam", "dispatch", "t-orange"]
    ];
    const NS = "http://www.w3.org/2000/svg";
    const card = (id) => board.querySelector(`.eb-card[data-id="${id}"]`);
    $$(".eb-card", board).forEach((c, i) => c.style.setProperty("--i", i));
    // Each card's pin: the top centre of the card as laid out, rotation included.
    const pin = (el, box) => {
      const r = el.querySelector(".eb-card__pin").getBoundingClientRect();
      return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
    };
    const draw = () => {
      const box = board.getBoundingClientRect();
      if (!box.width) return;
      svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      svg.textContent = "";
      LINKS.forEach(([a, b, tone]) => {
        const A = card(a), B = card(b);
        if (!A || !B || !A.offsetParent || !B.offsetParent) return;
        const [x1, y1] = pin(A, box), [x2, y2] = pin(B, box);
        const line = document.createElementNS(NS, "line");
        line.setAttribute("x1", x1); line.setAttribute("y1", y1);
        line.setAttribute("x2", x2); line.setAttribute("y2", y2);
        line.setAttribute("class", `eb__line ${tone}`);
        line.dataset.a = a; line.dataset.b = b;
        line.style.setProperty("--len", Math.hypot(x2 - x1, y2 - y1).toFixed(1));
        svg.appendChild(line);
      });
    };
    // Hover: the card lifts (CSS) and its lines brighten.
    board.addEventListener("pointerover", (e) => {
      const c = e.target.closest(".eb-card");
      if (!c) return;
      $$(".eb__line", svg).forEach(l => l.classList.toggle("is-hot", l.dataset.a === c.dataset.id || l.dataset.b === c.dataset.id));
    });
    board.addEventListener("pointerleave", () => $$(".eb__line", svg).forEach(l => l.classList.remove("is-hot")));
    draw();
    new ResizeObserver(() => draw()).observe(board);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    if (prefersReducedMotion.matches) return;
    // Entrance: cards fade and slide in one after another, then the lines draw in.
    wrap.classList.add("js-anim");
    const play = () => requestAnimationFrame(() => requestAnimationFrame(() => { draw(); wrap.classList.add("is-in"); }));
    new IntersectionObserver(([en], ob) => { if (en.isIntersecting) { ob.disconnect(); play(); } }, { threshold: 0.2 }).observe(wrap);
  }

  /* ------------------------------------------------------------------------
     9. HERO FOCUS LENS — blurred document texture sharpened under the cursor
     ------------------------------------------------------------------------ */
  function initHeroLens() {
    const hero = $(".hero"), docEl = $("#heroDoc");
    if (!hero || !docEl) return;
    const LINES = [
      "INCIDENT REPORT · PAGE 3 OF 12", "Reporting officer: ██████████", "Statement of witness, recorded ██/██", "Exhibit 14 · surveillance still, cam 2",
      "Time of call: ██:██:██", "Location: ████████████ Blvd.", "Chain of custody · item 7 of 9", "Transcript p. 41, lines 3–18",
      "Body-camera file 0347 · 00:12:44", "Interview notes, continued ███████", "Discovery index · 214 items", "Lab request · item 4 · pending",
      "Witness 2 description: ██████ ████", "Dispatch log · unit ██ en route", "Photo array · six positions", "Supplemental report · ██████",
      "Q. Where were you standing? ████", "A. ███████ near the counter ████", "Evidence tag #A-1182 · sealed", "Request for disclosure · ██ §",
      "Timestamp 00:00:58 — 00:01:04", "Officer notes, page 2 of 2 ████", "Booking record ████████ · ██", "Property voucher · ███████"
    ];
    let text = "";
    for (let r = 0; r < 7; r++) for (let i = 0; i < LINES.length; i++) text += LINES[(i * 5 + r * 7) % LINES.length] + "\n";
    $$(".doc-layer", docEl).forEach(l => { l.textContent = text; });

    let tx = 0, ty = 0, x = 0, y = 0, auto = true, raf = null, idle = null, t0 = performance.now(), visible = true;
    const place = () => { docEl.style.setProperty("--lx", `${x}px`); docEl.style.setProperty("--ly", `${y}px`); };
    const home = () => { tx = x = hero.clientWidth * 0.68; ty = y = hero.clientHeight * 0.42; place(); };
    home();
    if (prefersReducedMotion.matches) return;

    const tick = (now) => {
      if (auto) {
        const t = (now - t0) / 1000, w = hero.clientWidth, h = hero.clientHeight;
        tx = w * (0.64 + 0.2 * Math.sin(t * 0.32));
        ty = h * (0.45 + 0.2 * Math.sin(t * 0.47 + 1.2));
      }
      x += (tx - x) * 0.09; y += (ty - y) * 0.09;
      place();
      raf = visible ? requestAnimationFrame(tick) : null;
    };
    hero.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = hero.getBoundingClientRect();
      tx = e.clientX - r.left; ty = e.clientY - r.top; auto = false;
      clearTimeout(idle);
      idle = setTimeout(() => { auto = true; }, 3500);
    });
    window.addEventListener("resize", home);
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    }).observe(hero);
  }

  /* ------------------------------------------------------------------------
     10. HEADLINE WORD REVEALS
     ------------------------------------------------------------------------ */
  function initSplit() {
    if (prefersReducedMotion.matches) return;
    $$(".hero__title, .section__title, .mission__title").forEach(el => {
      let i = 0;
      const walk = (node) => {
        Array.from(node.childNodes).forEach(n => {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(part => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              const w = document.createElement("span"); w.className = "w";
              const inner = document.createElement("span"); inner.className = "w__i"; inner.textContent = part;
              inner.style.transitionDelay = `${Math.min(i++, 20) * 0.05}s`;
              w.appendChild(inner); frag.appendChild(w);
            });
            n.replaceWith(frag);
          } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
        });
      };
      walk(el);
      el.classList.add("split");
    });
  }

  /* ------------------------------------------------------------------------
     12. PROBLEM — 2,080-hour year, caseload simulator, evidence convergence
     ------------------------------------------------------------------------ */
  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* The 2,080-hour year: one attorney's working year drawn hour by hour.
     1973 ceiling: 150 felonies → 2,080 / 150 ≈ 13.9 h per case (fits exactly).
     2023 study: 35 h per low-level felony → floor(2,080 / 35) = 59 cases fit; 91 do not. */
  function initYear() {
    const root = $("#yr");
    if (!root) return;
    const scroller = $("#yrScroll"), stage = $("#yrStage"), wrap = $("#yrWrap"), cv = $("#yrCanvas");
    const ctx = cv.getContext("2d");
    const tip = $("#yrTip"), cap = $("#yrCap"), perEl = $("#yrPer"), fitEl = $("#yrFit"), outEl = $("#yrOut");
    const btns = $$(".yr__btn", root);
    const HOURS = 2080, HPW = 40, WEEKS = 52, CASES = 150, H73 = HOURS / CASES, H23 = 35;
    const COL = {
      empty: "rgba(11, 23, 54, 0.07)", a: "#0B1736", b: "#3A4D78", cut: "#D4C1A1",
      outFill: "rgba(212, 193, 161, 0.32)", outLine: "#A88A58", frame: "rgba(11, 23, 54, 0.22)",
      label: "#69728A", edge: "#A88A58"
    };
    const CAPS = {
      fill: `<span class="yr__cap-k">1973</span>Spread across a 2,080-hour working year, 150 cases leave about <b>13.9 hours</b> for each one.`,
      y73: `<span class="yr__cap-k">1973</span>Spread across a 2,080-hour working year, 150 cases leave about <b>13.9 hours</b> for each one.`,
      mid: `<span class="yr__cap-k">2023</span>The National Public Defense Workload Study recommends <b>35 hours</b> for even a low-level felony.`,
      end: `<span class="yr__cap-k">The gap</span>The year is full by case 59. <b>The other 91</b> don't get the time the study recommends.`
    };
    let fill = 0, t = 0, vertical = false, g = null, dpr = 1, mode = "", capKey = "", tween = null, hoverXY = null;

    const hFor = (tt) => H73 + (H23 - H73) * tt;
    const fitFor = (h) => Math.min(CASES, Math.floor(HOURS / h + 1e-9));

    const layout = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      vertical = w < 640;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      const axisTop = vertical ? 0 : 18, axisLeft = vertical ? 30 : 0;
      const trayH = vertical ? 62 : 52, sep = 16;
      const cols = vertical ? HPW : WEEKS, rows = vertical ? WEEKS : HPW;
      const gridW = w - axisLeft;
      const px = gridW / cols;
      const py = Math.max(2.5, Math.min(px * (vertical ? 0.8 : 0.5), (h - axisTop - trayH - sep) / rows));
      const gridH = py * rows;
      const used = axisTop + gridH + sep + trayH;
      const top = Math.max(0, (h - used) / 2);
      g = { w, h, cols, rows, px, py, gx: axisLeft, gy: top + axisTop, gridW, gridH, trayY: top + axisTop + gridH + sep, trayH, axisTop, axisLeft, top };
      draw();
    };

    const cellXY = (k) => {
      const week = Math.floor(k / HPW), hr = k % HPW;
      const c = vertical ? hr : week, r = vertical ? week : hr;
      return [g.gx + c * g.px, g.gy + r * g.py];
    };

    const draw = () => {
      if (!g) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);
      const h = hFor(t), fit = fitFor(h), shown = Math.round(fill * HOURS);
      const gap = g.px > 12 ? 1.5 : 1, gapY = g.py > 5 ? 1.2 : 0.8;

      // Axis labels
      ctx.font = "500 10px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.fillStyle = COL.label; ctx.textBaseline = "alphabetic";
      const months = [["JAN", 0], ["APR", 13], ["JUL", 26], ["OCT", 39]];
      if (vertical) months.forEach(([m, wk]) => ctx.fillText(m, 0, g.gy + wk * g.py + 8));
      else {
        months.forEach(([m, wk]) => ctx.fillText(m, g.gx + wk * g.px, g.gy - 7));
        ctx.textAlign = "right"; ctx.fillText("WEEK 52", g.gx + g.gridW, g.gy - 7); ctx.textAlign = "left";
      }

      // Faint hour grid (the empty year)
      ctx.fillStyle = COL.empty;
      for (let k = 0; k < HOURS; k++) {
        const [x, y] = cellXY(k);
        ctx.fillRect(x, y, g.px - gap, g.py - gapY);
      }
      // Cases: one continuous block per case within each week, hairline gap between cases
      const segGap = vertical ? 1.5 : 2;
      for (let wk = 0; wk < WEEKS; wk++) {
        let hr = 0;
        while (hr < HPW) {
          const k0 = wk * HPW + hr;
          if (k0 >= shown) break;
          const ci = Math.floor((k0 + 0.5) / h);
          let len = 1;
          while (hr + len < HPW && wk * HPW + hr + len < shown && Math.floor((wk * HPW + hr + len + 0.5) / h) === ci) len++;
          const endsCase = hr + len < HPW && wk * HPW + hr + len < shown; // next cell starts a new case
          ctx.fillStyle = ci >= fit ? COL.cut : (ci % 2 ? COL.b : COL.a);
          if (vertical) {
            const x = g.gx + hr * g.px, y = g.gy + wk * g.py;
            ctx.fillRect(x, y, len * g.px - (endsCase ? segGap : gap), g.py - gapY);
          } else {
            const x = g.gx + wk * g.px, y = g.gy + hr * g.py;
            ctx.fillRect(x, y, g.px - gap, len * g.py - (endsCase ? segGap : gapY));
          }
          hr += len;
        }
      }

      // Faint hour rules inside the filled blocks, so each hour stays legible
      if ((vertical ? g.px : g.py) >= 4) {
        ctx.fillStyle = "rgba(247, 247, 243, 0.13)";
        for (let i = 1; i < HPW; i++) {
          if (vertical) ctx.fillRect(g.gx + i * g.px - 0.5, g.gy, 0.6, g.gridH);
          else ctx.fillRect(g.gx, g.gy + i * g.py - 0.5, g.gridW, 0.6);
        }
      }

      // Edge of the year
      const ey = g.trayY - g.trayH * 0 - 8;
      ctx.strokeStyle = COL.edge; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(g.gx, ey); ctx.lineTo(g.gx + g.gridW, ey); ctx.stroke(); ctx.setLineDash([]);

      // Overflow tray: cases left without the recommended time
      const out = shown >= HOURS ? CASES - fit : 0;
      ctx.fillStyle = out ? COL.outLine : COL.label;
      ctx.font = "500 10px 'IBM Plex Mono', ui-monospace, monospace";
      const label = out ? `${out} ${out === 1 ? "CASE" : "CASES"} BEYOND THE END OF THE YEAR` : "END OF THE WORKING YEAR · 2,080 H";
      ctx.fillText(label, g.gx, g.trayY + 6);
      const perRow = vertical ? 46 : 91, rowsN = Math.ceil((CASES - 59) / perRow);
      const sw = g.gridW / perRow, sh = Math.max(10, (g.trayH - 16 - (rowsN - 1) * 4) / rowsN);
      for (let i = 0; i < out; i++) {
        const r = Math.floor(i / perRow), c = i % perRow;
        const x = g.gx + c * sw, y = g.trayY + 14 + r * (sh + 4);
        ctx.fillStyle = COL.outFill; ctx.fillRect(x + 0.5, y + 0.5, sw - 3, sh - 1);
        ctx.strokeStyle = COL.outLine; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, sw - 3, sh - 1);
      }

      // Facts, caption, toggle state
      const casesShown = Math.min(CASES, Math.floor(shown / h + 1e-9));
      perEl.textContent = t < 0.01 ? "≈13.9" : t > 0.99 ? "35" : h.toFixed(1);
      fitEl.textContent = String(fill < 1 ? casesShown : fit);
      outEl.textContent = String(out);
      root.classList.toggle("has-out", out > 0);
      const key = fill < 1 ? "fill" : t < 0.02 ? "y73" : t < 0.98 ? "mid" : "end";
      if (key !== capKey) { capKey = key; cap.innerHTML = CAPS[key]; }
      const is23 = t >= 0.5;
      btns.forEach(b => b.setAttribute("aria-pressed", String((b.dataset.yr === "1") === is23)));
      if (hoverXY) showTip(hoverXY[0], hoverXY[1]);
    };

    // Tooltip
    const showTip = (mx, my) => {
      if (!g || fill < 1) { tip.hidden = true; return; }
      const h = hFor(t), fit = fitFor(h), hLabel = t < 0.01 ? "≈13.9" : t > 0.99 ? "35" : h.toFixed(1);
      let text = "";
      const c = Math.floor((mx - g.gx) / g.px), r = Math.floor((my - g.gy) / g.py);
      if (c >= 0 && c < g.cols && r >= 0 && r < g.rows) {
        const week = vertical ? r : c, hr = vertical ? c : r;
        const k = week * HPW + hr, ci = Math.floor((k + 0.5) / h);
        text = ci >= fit ? `Case ${ci + 1} · cut off by the end of the year` : `Case ${ci + 1} of 150 · ${hLabel} h · week ${week + 1}`;
      } else if (my >= g.trayY + 14 && fill >= 1) {
        const perRow = vertical ? 46 : 91, sw = g.gridW / perRow, rowsN = Math.ceil((CASES - 59) / perRow);
        const sh = Math.max(10, (g.trayH - 16 - (rowsN - 1) * 4) / rowsN);
        const i = Math.floor((my - g.trayY - 14) / (sh + 4)) * perRow + Math.floor((mx - g.gx) / sw);
        if (i >= 0 && i < CASES - fit) text = `Case ${fit + 1 + i} · no hours left in the year`;
      }
      if (!text) { tip.hidden = true; return; }
      tip.textContent = text; tip.hidden = false;
      tip.style.left = `${Math.min(Math.max(mx, 90), g.w - 90)}px`; tip.style.top = `${my}px`;
    };
    cv.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = cv.getBoundingClientRect();
      hoverXY = [e.clientX - r.left, e.clientY - r.top];
      showTip(hoverXY[0], hoverXY[1]);
    });
    cv.addEventListener("pointerleave", () => { hoverXY = null; tip.hidden = true; });

    // Scroll-driven beats
    const headerH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64;
    const progress = () => {
      const total = scroller.offsetHeight - stage.offsetHeight;
      if (total <= 0) return 0;
      return (headerH() - scroller.getBoundingClientRect().top) / total;
    };
    const fromScroll = () => {
      if (mode !== "live") return;
      const p = progress();
      fill = clamp01((p + 0.1) / 0.3);
      t = easeInOut(clamp01((p - 0.36) / 0.36));
      draw();
    };
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (mode !== "live" || ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; fromScroll(); });
    }, { passive: true });

    // Tweens for static mode
    const tweenTo = (prop, to, dur) => {
      cancelAnimationFrame(tween);
      if (prefersReducedMotion.matches) { if (prop === "t") t = to; else fill = to; draw(); return; }
      const from = prop === "t" ? t : fill, start = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - start) / dur), v = from + (to - from) * easeInOut(k);
        if (prop === "t") t = v; else fill = v;
        draw();
        if (k < 1) tween = requestAnimationFrame(step);
      };
      tween = requestAnimationFrame(step);
    };

    btns.forEach(b => b.addEventListener("click", () => {
      const to23 = b.dataset.yr === "1";
      if (mode === "live") {
        const total = scroller.offsetHeight - stage.offsetHeight;
        const top = scroller.getBoundingClientRect().top + window.scrollY - headerH();
        window.scrollTo({ top: top + total * (to23 ? 0.86 : 0.27), behavior: prefersReducedMotion.matches ? "auto" : "smooth" });
      } else {
        if (fill < 1) fill = 1;
        tweenTo("t", to23 ? 1 : 0, 1400);
      }
    }));

    // Mode: scroll-driven ("live") on capable viewports, static otherwise
    const setMode = () => {
      const next = prefersReducedMotion.matches || window.innerHeight < 600 ? "static" : "live";
      if (next !== mode) {
        mode = next;
        scroller.classList.toggle("is-static", mode === "static");
        scroller.classList.toggle("is-live", mode === "live");
        if (mode === "static") { fill = prefersReducedMotion.matches ? 1 : fill; }
      }
      layout();
      if (mode === "live") fromScroll();
    };

    if ("ResizeObserver" in window) new ResizeObserver(() => layout()).observe(wrap);
    window.addEventListener("resize", setMode);
    setMode();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw());

    // Static mode: fill the year when it comes into view
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting || mode !== "static") return;
        if (fill < 1) tweenTo("fill", 1, 1600);
        io.disconnect();
      }, { threshold: 0.35 });
      io.observe(wrap);
    } else { fill = 1; draw(); }
  }

  function initSimulator() {
    const root = $("#sim");
    if (!root) return;
    const CAP = 2080; // 40 h × 52 weeks, illustrative annual availability
    const range = $("#simCases"), out = $("#simCasesOut");
    const radios = $$("#simTypes [role=radio]");
    const fill = $("#simFill"), over = $("#simOver"), cap = $("#simCap"), capLbl = cap.firstElementChild;
    const need = $("#simNeed"), excess = $("#simExcess"), excessK = $("#simExcessK");
    let hours = Number(radios.find(r => r.getAttribute("aria-checked") === "true").dataset.h);
    let last = { need: 0, diff: 0 };

    const update = () => {
      const n = Number(range.value);
      const total = n * hours;
      const diff = total - CAP;
      const scale = Math.max(total, CAP);
      const capPct = (CAP / scale) * 100;
      out.textContent = fmt.format(n);
      range.style.setProperty("--pct", `${((n - range.min) / (range.max - range.min)) * 100}%`);
      fill.style.width = `${(Math.min(total, CAP) / scale) * 100}%`;
      over.style.left = `${capPct}%`;
      over.style.width = `${(Math.max(0, diff) / scale) * 100}%`;
      cap.style.left = `calc(${capPct}% - 1px)`;
      root.classList.toggle("is-over", diff > 0);
      root.classList.toggle("is-full", capPct > 88);
      capLbl.style.left = capPct < 12 ? "0" : "";
      capLbl.style.transform = capPct < 12 ? "none" : "";
      excessK.textContent = diff > 0 ? "Over capacity" : "Hours to spare";
      const sign = diff > 0 ? "+" : "";
      animateNumber(need, total, { from: last.need, duration: 450 });
      animateNumber(excess, Math.abs(diff), { from: Math.abs(last.diff), duration: 450, format: (v) => sign + fmt.format(Math.round(v)) });
      range.setAttribute("aria-valuetext", `${n} cases, ${fmt.format(Math.round(total))} hours needed`);
      last = { need: total, diff };
    };

    const select = (btn, focus) => {
      radios.forEach(r => { const on = r === btn; r.setAttribute("aria-checked", String(on)); r.tabIndex = on ? 0 : -1; });
      hours = Number(btn.dataset.h);
      if (focus) btn.focus();
      update();
    };
    radios.forEach(r => {
      r.tabIndex = r.getAttribute("aria-checked") === "true" ? 0 : -1;
      r.addEventListener("click", () => select(r));
    });
    $("#simTypes").addEventListener("keydown", (e) => {
      const i = radios.indexOf(document.activeElement);
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (i < 0 || !d) return;
      e.preventDefault();
      select(radios[(i + d + radios.length) % radios.length], true);
    });
    range.addEventListener("input", update);
    update();
  }

  function initEvidence() {
    const wrap = $("#evScroll"), stage = $("#evStage");
    if (!wrap || prefersReducedMotion.matches || !("IntersectionObserver" in window)) return; // static timeline is the fallback
    const docs = $$(".edoc", stage);
    const title = $(".evs__title", stage), foot = $(".evs__foot", stage), axis = $(".evs__axis", stage);
    // Scattered pose per doc: x, y (fractions of half-stage), z px, rotX, rotY, rotZ
    const SCATTER = [
      [-0.62, -0.18, 160, 18, -26, -14],
      [0.6, -0.26, -120, -14, 30, 10],
      [-0.56, 0.5, -40, 24, 18, 16],
      [0.62, 0.46, 90, -22, -20, -9],
      [0.04, 0.24, -260, 10, -8, 6]
    ];
    const labels = docs.map(d => {
      const el = document.createElement("div");
      el.className = "evs__lbl";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = `<b>${d.dataset.t}</b><span>${d.dataset.k}</span>`;
      stage.appendChild(el);
      return el;
    });
    wrap.classList.add("is-live");

    let geo = null, visible = false, raf = 0;
    const layout = () => {
      const W = stage.clientWidth, H = stage.clientHeight;
      const top = title.offsetTop + title.offsetHeight + 28;
      const bottom = foot.offsetTop - 20;
      const vert = W < 720;
      wrap.classList.toggle("is-vert", vert);
      let s, finals, box, lbls;
      if (vert) {
        s = 0.44;
        const step = Math.max(44, (bottom - top - 224 * s) / (docs.length - 1));
        finals = docs.map((_, i) => [34, top - H / 2 + 112 * s + i * step]);
        box = { left: W / 2 - 22, top: top + 112 * s, width: 2, height: step * (docs.length - 1) };
        lbls = finals.map(([, y]) => [-36, y - 14]);
      } else {
        s = Math.min(1, (W - 96) / (docs.length * 176 * 1.14), (bottom - top - 70) / 224);
        const step = 176 * s * 1.14;
        const cy = (top + bottom) / 2 - H / 2 - 30;
        finals = docs.map((_, i) => [(i - (docs.length - 1) / 2) * step, cy]);
        box = { left: W / 2 + finals[0][0], top: H / 2 + cy + 112 * s + 16, width: step * (docs.length - 1), height: 2 };
        lbls = finals.map(([x]) => [x, cy + 112 * s + 28]);
      }
      Object.assign(axis.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
      labels.forEach((el, i) => {
        el.style.transform = `translate(${lbls[i][0]}px, ${lbls[i][1]}px) translateX(${vert ? "-100%" : "-50%"})`;
        el.style.textAlign = vert ? "right" : "center";
      });
      geo = { W, H, s, finals, s0: Math.max(s, 0.55) * 0.95, stick: parseFloat(getComputedStyle(stage).top) || 0 };
    };

    const frame = (now) => {
      raf = 0;
      if (!geo) layout();
      const { W, H, s, s0, finals, stick } = geo;
      const total = wrap.offsetHeight - stage.offsetHeight;
      const p = clamp01((stick - wrap.getBoundingClientRect().top) / total);
      const time = now / 1000;
      docs.forEach((d, i) => {
        const t = easeInOut(clamp01((p - 0.06 - i * 0.045) / 0.56));
        const [fx, fy, z, rx, ry, rz] = SCATTER[i];
        const k = 1 - t;
        const bob = k * Math.sin(time * 0.9 + i * 1.7) * 10;
        const x = fx * (W / 2) * k + finals[i][0] * t;
        const y = fy * (H / 2) * k + finals[i][1] * t + bob;
        d.style.transform = `translate3d(${x}px, ${y}px, ${z * k}px) rotateX(${rx * k}deg) rotateY(${ry * k}deg) rotateZ(${rz * k}deg) scale(${s0 + (s - s0) * t})`;
      });
      const p2 = clamp01((p - 0.66) / 0.22);
      stage.style.setProperty("--p2", p2.toFixed(3));
      wrap.classList.toggle("is-done", p2 > 0.95);
      if (visible) raf = requestAnimationFrame(frame);
    };

    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(wrap);
    window.addEventListener("resize", () => { geo = null; }, { passive: true });
    raf = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------------
     11. BOOT
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.classList.remove("no-js");
    renderCases();      // must precede reveal so cards get observed
    Modal.init();
    initYear();
    initSimulator();
    initEvidence();
    initHeroLens();
    initEvidenceBoard();
    initNav();
    initSplit();        // must precede reveal so split titles get observed
    initReveal();
    initCounters();
  });

  // Expose for tests/debugging
  window.CaseLens = { CASES, ARCHIVE, Modal };
})();
