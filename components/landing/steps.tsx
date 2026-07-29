const STEPS = [
  {
    number: "1",
    title: "Type an org",
    body: "Any public GitHub organization — vercel, facebook, golang.",
  },
  {
    number: "2",
    title: "Browse the collated list",
    body: "Every issue from every repo, in one filterable stream.",
  },
  {
    number: "3",
    title: "Jump into GitHub",
    body: "One click takes you to the original issue to comment or pick it up.",
  },
];

export function Steps() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-section-lg">
      <div className="rounded-lg bg-surface px-8 py-section-sm sm:px-12">
        <h2 className="text-center text-heading-2 text-ink">Zero setup. Three steps.</h2>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number}>
              <p className="text-heading-2 text-stone">{step.number}</p>
              <h3 className="mt-3 text-heading-5 text-ink">{step.title}</h3>
              <p className="mt-2 text-body-sm text-slate">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
