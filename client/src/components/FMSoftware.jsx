import { useState, useEffect, useRef, useCallback } from "react";
import "./FMSoftware.css";

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "services", label: "What I Build" },
  { id: "work", label: "Work" },
  { id: "studio", label: "The Studio" },
  { id: "contact", label: "Contact" },
];

const LANES = [
  {
    id: "automation",
    accent: "sage",
    title: "Automation",
    lead: "Turn manual, repeatable work into reliable software.",
    body:
      "Invoice handling, document processing, data entry, reporting — if your team does it every week by hand, it can probably be automated. I build workflow automations that quietly do the boring work, with the logging and error handling to keep them dependable.",
    points: ["Document OCR & processing", "Workflow & approval automation", "System integrations & APIs", "Scheduled jobs & reporting"],
    proof: "OCR Rename — a live document automation tool",
  },
  {
    id: "ai",
    accent: "peach",
    title: "AI Products",
    lead: "Practical AI built on today's best models.",
    body:
      "Voice, chat, content generation and document intelligence, built on models like Claude and GPT and shipped as real products. I work with AI APIs every day and know where they shine, where they fall over, and how to build around both.",
    points: ["LLM-powered apps & assistants", "Voice & chat experiences", "Document AI & extraction", "AI workflow integration"],
    proof: "AI Chrome extension — 700+ users on the Web Store",
  },
  {
    id: "platforms",
    accent: "clay",
    title: "Platforms & Portals",
    lead: "Secure systems your clients and teams rely on.",
    body:
      "Client portals, community platforms and internal tools — full-stack builds with proper authentication, data handling and accessibility. Built by someone whose background is systems where failure was never an option.",
    points: ["Client & case portals", "Community platforms & maps", "Internal tools & dashboards", "Websites that generate enquiries"],
    proof: "Travelstead law portal · Pride Path NGO platform",
  },
];

const PROJECTS = [
  {
    id: 1,
    sector: "Legal",
    title: "Narayan Travelstead Law Portal",
    description:
      "Secure client portal for a law firm. Document management, case tracking, scheduling and secure messaging, designed around confidentiality.",
    tags: ["React", "Node.js", "PostgreSQL"],
    status: "In progress",
    featured: true,
  },
  {
    id: 2,
    sector: "NGO & Community",
    title: "Pride Path",
    description:
      "Community platform connecting the LGBTQ+ community with resources, events and safe spaces. Full-stack build with accessibility at its core.",
    tags: ["React", "Node.js", "Accessibility"],
    link: "https://lgbtpridepath.org",
    status: "Live",
  },
  {
    id: 3,
    sector: "NGO & Community",
    title: "Pride Widget & Map",
    description:
      "Interactive map and embeddable widget for organisations to showcase LGBTQ+ friendly locations, with real-time data.",
    tags: ["React", "Mapbox", "API"],
    link: "https://www.lgbtnearme.org/widget",
    status: "Live",
  },
  {
    id: 4,
    sector: "Automation",
    title: "OCR Rename",
    description:
      "Document automation tool using optical character recognition to rename and organise files automatically. Built to remove a real workflow pain.",
    tags: ["JavaScript", "OCR"],
    link: "https://ocrrename.com",
    status: "Live",
  },
  {
    id: 5,
    sector: "AI",
    title: "GPT Cover Letter Generator",
    description:
      "AI-powered Chrome extension generating tailored cover letters from job postings. 700+ users through organic growth.",
    tags: ["JavaScript", "GPT", "Chrome API"],
    status: "Live",
  },
  {
    id: 6,
    sector: "Healthcare & Practice",
    title: "Clair Dunne Psychotherapy",
    description:
      "Full brand presence and web platform for a Dublin psychotherapist. Calming, accessible design with booking integration.",
    tags: ["HTML", "CSS", "JavaScript"],
    link: "https://clairdunne.com",
    status: "Live",
  },
];

const TRUST = [
  { value: "Heathrow", label: "Mission-critical systems experience, 24/7, zero downtime tolerance" },
  { value: "6+", label: "Client projects delivered across Ireland, the UK and the US" },
  { value: "500K+", label: "Users reached through apps, AR and browser extensions" },
];

const JOURNEY = [
  { period: "2023 — Present", role: "Lead Developer, FM Software", detail: "Running a software studio partnering with businesses, law firms and NGOs across Ireland, the UK, the US and Australia." },
  { period: "2022 — 2023", role: "MSc Software Engineering, Distinction", detail: "University of Hertfordshire. Thesis: fine-tuning a GPT model on clinical dementia-care conversations." },
  { period: "2019 — 2020", role: "Software Engineer, Heathrow Airport", detail: "Mission-critical systems across terminals. Real-time applications, PLC integration and SCADA, operating 24/7." },
  { period: "2014 — 2018", role: "BEng Electronic & Computer Engineering", detail: "NUI Galway. Hardware, embedded systems, signal processing and software." },
];

/* ------------------------------------------------------------------ */
/*  SVG pieces                                                         */
/* ------------------------------------------------------------------ */

/* Curved divider line that draws itself in as the section arrives */
const Divider = ({ flip = false }) => (
  <div className={`divider ${flip ? "divider--flip" : ""}`} data-reveal aria-hidden="true">
    <svg viewBox="0 0 600 40" preserveAspectRatio="none">
      <path
        className="divider__path"
        pathLength="1"
        d="M0 30 C 120 6, 240 6, 320 22 S 520 38, 600 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle className="divider__seed" cx="600" cy="14" r="4" fill="currentColor" />
    </svg>
  </div>
);

/* Soft layered hills behind the hero */
const HeroLandscape = () => (
  <div className="hero__landscape" aria-hidden="true">
    <svg viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice">
      <path className="hill hill--back" d="M0 320 C 240 220, 420 280, 640 240 S 1080 160, 1440 260 V 420 H 0 Z" />
      <path className="hill hill--mid" d="M0 360 C 200 300, 480 330, 720 300 S 1180 250, 1440 330 V 420 H 0 Z" />
      <path className="hill hill--front" d="M0 400 C 300 350, 600 380, 900 360 S 1280 330, 1440 380 V 420 H 0 Z" />
      <circle className="hero__sun" cx="1140" cy="130" r="52" />
      <g className="hero__birds">
        <path d="M300 110 q 8 -8 16 0 q 8 -8 16 0" />
        <path d="M360 90 q 7 -7 14 0 q 7 -7 14 0" />
        <path d="M260 80 q 6 -6 12 0 q 6 -6 12 0" />
      </g>
    </svg>
  </div>
);

const LaneIcon = ({ id }) => {
  const c = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (id === "automation")
    return (
      <svg {...c}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
      </svg>
    );
  if (id === "ai")
    return (
      <svg {...c}>
        <path d="M12 3a6.5 6.5 0 0 1 6.5 6.5c0 2.4-1.3 4.2-2.8 5.5-.7.6-1.2 1.5-1.2 2.5V19h-5v-1.5c0-1-.5-1.9-1.2-2.5C6.8 13.7 5.5 11.9 5.5 9.5A6.5 6.5 0 0 1 12 3Z" />
        <path d="M9.5 21h5" />
      </svg>
    );
  return (
    <svg {...c}>
      <rect x="3" y="4" width="18" height="14" rx="2.5" />
      <path d="M3 9h18M8 9v9" />
    </svg>
  );
};

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const ArrowIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FMSoftware() {
  const [activeSection, setActiveSection] = useState("home");
  const [tlProgress, setTlProgress] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [formState, setFormState] = useState({ status: "idle", note: "" });
  const sectionRefs = useRef({});
  const timelineRef = useRef(null);

  /* Track active section + timeline draw progress */
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const offsets = NAV_ITEMS.map(({ id }) => {
          const el = sectionRefs.current[id];
          return { id, top: el ? Math.abs(el.getBoundingClientRect().top - 110) : Infinity };
        });
        setActiveSection(offsets.reduce((a, b) => (b.top < a.top ? b : a)).id);

        if (timelineRef.current) {
          const r = timelineRef.current.getBoundingClientRect();
          const p = (window.innerHeight * 0.85 - r.top) / r.height;
          setTlProgress(Math.min(Math.max(p, 0), 1));
        }
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Scroll-driven reveals: every [data-reveal] builds in once */
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            obs.unobserve(e.target);
          }
        }),
      { threshold: 0.16 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const scrollTo = useCallback((id) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const submitContact = async () => {
    if (!form.name || !form.email || !form.message) {
      setFormState({ status: "error", note: "Please fill in all three fields." });
      return;
    }
    setFormState({ status: "sending", note: "" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setFormState({ status: "sent", note: "Thanks! Your message has been received. I'll reply within one working day." });
        setForm({ name: "", email: "", message: "" });
      } else {
        setFormState({ status: "error", note: data.message || "Something went wrong. Email me directly instead." });
      }
    } catch {
      setFormState({ status: "error", note: "Could not reach the server. Email me directly at the address below." });
    }
  };

  return (
    <div className="fm">
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Karla:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* -------- Nav -------- */}
      <nav className="nav">
        <button className="nav__brand" onClick={() => scrollTo("home")}>
          <span className="nav__mark" aria-hidden="true" />
          FM Software
        </button>
        <div className="nav__links">
          {NAV_ITEMS.map(({ id, label }) => (
            <button
              key={id}
              className={`nav__link ${activeSection === id ? "nav__link--active" : ""}`}
              onClick={() => scrollTo(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="nav__cta" onClick={() => scrollTo("contact")}>
          Start a project
        </button>
      </nav>

      <main>
        {/* -------- Hero -------- */}
        <section ref={(el) => (sectionRefs.current.home = el)} className="hero">
          <HeroLandscape />
          <div className="hero__inner">
            <p className="hero__eyebrow" data-reveal>
              FM Software · Galway, Ireland
            </p>
            <h1 className="hero__title" data-reveal style={{ transitionDelay: "0.08s" }}>
              Software, automation
              <br />
              and AI — <em>built properly.</em>
            </h1>
            <p className="hero__lead" data-reveal style={{ transitionDelay: "0.16s" }}>
              A one-person Irish studio building custom software for businesses, law firms,
              NGOs and public organisations. Direct communication, careful engineering and
              work that ships on time.
            </p>
            <div className="hero__actions" data-reveal style={{ transitionDelay: "0.24s" }}>
              <button className="btn btn--solid" onClick={() => scrollTo("services")}>
                See what I build <ArrowIcon />
              </button>
              <button className="btn btn--soft" onClick={() => scrollTo("contact")}>
                Start a conversation
              </button>
            </div>

            <div className="trust" data-reveal style={{ transitionDelay: "0.34s" }}>
              {TRUST.map((t, i) => (
                <div key={i} className="trust__item">
                  <span className="trust__value">{t.value}</span>
                  <span className="trust__label">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------- Services: three equal lanes -------- */}
        <section ref={(el) => (sectionRefs.current.services = el)} className="section services">
          <Divider />
          <div className="container">
            <p className="eyebrow" data-reveal>What I build</p>
            <h2 className="heading" data-reveal>
              Three kinds of problem,
              <br />
              one careful builder.
            </h2>
            <div className="lanes">
              {LANES.map((lane, i) => (
                <article
                  key={lane.id}
                  className={`lane lane--${lane.accent}`}
                  data-reveal
                  style={{ transitionDelay: `${i * 0.12}s` }}
                >
                  <div className="lane__icon"><LaneIcon id={lane.id} /></div>
                  <h3 className="lane__title">{lane.title}</h3>
                  <p className="lane__lead">{lane.lead}</p>
                  <p className="lane__body">{lane.body}</p>
                  <ul className="lane__points">
                    {lane.points.map((p) => (
                      <li key={p}>
                        <CheckIcon /> {p}
                      </li>
                    ))}
                  </ul>
                  <p className="lane__proof">{lane.proof}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* -------- Work -------- */}
        <section ref={(el) => (sectionRefs.current.work = el)} className="section work">
          <Divider flip />
          <div className="container">
            <p className="eyebrow" data-reveal>Selected work</p>
            <h2 className="heading" data-reveal>
              Built for law firms, NGOs
              <br />
              and growing businesses.
            </h2>
            <div className="projects">
              {PROJECTS.map((p, i) => (
                <article
                  key={p.id}
                  className={`project ${p.featured ? "project--featured" : ""}`}
                  data-reveal
                  style={{ transitionDelay: `${(i % 3) * 0.1}s` }}
                >
                  <div className="project__top">
                    <span className="project__sector">{p.sector}</span>
                    <span className={`project__status ${p.status === "Live" ? "project__status--live" : ""}`}>
                      {p.status}
                    </span>
                  </div>
                  <h3 className="project__title">{p.title}</h3>
                  <p className="project__desc">{p.description}</p>
                  <div className="project__foot">
                    <div className="project__tags">
                      {p.tags.map((t) => (
                        <span key={t} className="project__tag">{t}</span>
                      ))}
                    </div>
                    {p.link && (
                      <a className="project__link" href={p.link} target="_blank" rel="noopener noreferrer">
                        Visit <ArrowIcon />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* -------- Studio -------- */}
        <section ref={(el) => (sectionRefs.current.studio = el)} className="section studio">
          <Divider />
          <div className="container studio__grid">
            <div className="studio__story">
              <p className="eyebrow" data-reveal>The studio</p>
              <h2 className="heading" data-reveal>
                No agency overhead.
                <br />
                Just the engineer.
              </h2>
              <p className="studio__p" data-reveal>
                FM Software is run by Fechín Mitchell, a software engineer from Galway with a
                Master's in Software Engineering (Distinction) and hands-on experience building
                mission-critical systems at Heathrow Airport — software that ran 24/7 with zero
                tolerance for downtime.
              </p>
              <p className="studio__p" data-reveal>
                Working with me is simple. You tell me what you need, I listen and ask the right
                questions, then I build it properly. You get direct communication with the person
                writing your code, a clear scope and price before anything is built, and software
                that ships on time and works.
              </p>
              <div className="studio__steps" data-reveal>
                {["Talk", "Plan", "Build & ship"].map((s, i) => (
                  <div key={s} className="studio__step">
                    <span className="studio__step-num">{i + 1}</span>
                    {s}
                  </div>
                ))}
              </div>
            </div>

            <div className="studio__journey">
              <h3 className="studio__journey-title" data-reveal>The journey so far</h3>
              <div className="timeline" ref={timelineRef}>
                <div className="timeline__track" aria-hidden="true">
                  <div className="timeline__fill" style={{ transform: `scaleY(${tlProgress})` }} />
                </div>
                {JOURNEY.map((j, i) => (
                  <div key={i} className="timeline__item" data-reveal style={{ transitionDelay: `${i * 0.08}s` }}>
                    <span className="timeline__dot" />
                    <div>
                      <span className="timeline__period">{j.period}</span>
                      <h4 className="timeline__role">{j.role}</h4>
                      <p className="timeline__detail">{j.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* -------- Contact -------- */}
        <section ref={(el) => (sectionRefs.current.contact = el)} className="section contact">
          <Divider flip />
          <div className="container contact__grid">
            <div>
              <p className="eyebrow" data-reveal>Get in touch</p>
              <h2 className="heading" data-reveal>
                Have a project
                <br />
                in mind?
              </h2>
              <p className="contact__p" data-reveal>
                Whether it's an automation, an AI product or a full platform — tell me about it.
                No commitment, just a conversation. I reply within one working day.
              </p>
              {/* TODO: switch to letswork@fmsoftware.ie once mailbox is live */}
              <a className="contact__email" href="mailto:fechinmitchell1996@gmail.com" data-reveal>
                fechinmitchell1996@gmail.com
              </a>
            </div>
            <div className="form" data-reveal>
              <label className="form__field">
                <span>Your name</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Murphy"
                />
              </label>
              <label className="form__field">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@company.ie"
                />
              </label>
              <label className="form__field">
                <span>What do you need?</span>
                <textarea
                  rows="4"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="A short note about your project…"
                />
              </label>
              <button
                className="btn btn--solid form__send"
                onClick={submitContact}
                disabled={formState.status === "sending"}
              >
                {formState.status === "sending" ? "Sending…" : "Send message"} <ArrowIcon />
              </button>
              {formState.note && (
                <p className={`form__note ${formState.status === "error" ? "form__note--error" : ""}`}>
                  {formState.note}
                </p>
              )}
            </div>
          </div>
          <footer className="footer">
            <p>© 2026 FM Software · Fechín Mitchell · Galway, Ireland</p>
            <div className="footer__links">
              <a href="https://github.com/fechinmitchell" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a href="https://www.linkedin.com/in/fech%C3%ADn-mitchell/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
              <a href="https://www.fechinmitchell.com" target="_blank" rel="noopener noreferrer">fechinmitchell.com</a>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
