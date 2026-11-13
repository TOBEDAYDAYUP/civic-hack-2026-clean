export default function ParticipationView() {
  return (
    <>
      <section className="page-heading">
        <div className="eyebrow">YOUR VOICE MATTERS</div>
        <h1>
          Have a say in
          <br />
          your city.
        </h1>
        <p>
          Use official City of Toronto channels to find meetings, committee speaking opportunities,
          public consultations and your councillor.
        </p>
      </section>
      <section className="participation-grid">
        {[
          ['Find an upcoming meeting', 'https://www.toronto.ca/city-government/council/'],
          [
            'Contact your councillor',
            'https://www.toronto.ca/city-government/council/members-of-council/',
          ],
          [
            'Explore public consultations',
            'https://www.toronto.ca/community-people/get-involved/public-consultations/',
          ],
        ].map((x, i) => (
          <div className="info-card" key={x[0]}>
            <span className="number">0{i + 1} / GET INVOLVED</span>
            <h3>{x[0]}</h3>
            <p>Check the official City source for current dates, rules and deadlines.</p>
            <a href={x[1]} target="_blank" rel="noreferrer">
              Official City page ↗
            </a>
          </div>
        ))}
      </section>
    </>
  );
}
