export function Legal({ page }: { page: "privacy" | "terms" }) {
  return (
    <article className="panel legal">
      <span className="eyebrow">
        BITEZ COMMUNITY PILOT · UPDATED 4 OCTOBER 2026
      </span>
      <h1>
        {page === "privacy" ? "Privacy & account deletion" : "Community terms"}
      </h1>
      {page === "privacy" ? (
        <>
          <h2>Information we use</h2>
          <p>
            Bitez stores your account email, encrypted authentication
            credentials managed by Supabase, display name, profile postal code,
            optional block, hosted runs, reservations, reports and your
            blocked-neighbour list. We do not collect payment card details or
            require a phone number.
          </p>
          <h2>Location</h2>
          <p>
            Discovery location is used to search for runs and is not saved to
            your profile. Your browser asks permission before GPS access. You
            can choose an area instead. When hosting, you choose a public pickup
            location; its coordinates, postal code and instructions are visible
            to signed-in users along with your display name. Never publish a
            home unit number.
          </p>
          <h2>Who can see your order</h2>
          <p>
            Only you and the run’s host can read your reservation and display
            name. Other neighbours can see run availability, participant counts
            and estimated delivery shares. Supabase stores the database in
            Singapore; Vercel hosts the application. Both providers may keep
            operational logs under their own policies.
          </p>
          <h2>Delete your account and data</h2>
          <p>
            Open Account, sign in, then select Delete my account. Finish or
            cancel outstanding runs and reservations first. Deletion removes
            your account, profile, hosted runs, reservations and reports.
            Deleting a hosted run removes its participant orders too. Backups
            and infrastructure logs may remain until the providers’ retention
            periods expire. No account data is sold.
          </p>
          <h2>Questions or deletion assistance</h2>
          <p>
            Contact the Bitez pilot operator, Padmakar Pimpale, at{" "}
            <a href="mailto:2002padmakar@gmail.com">2002padmakar@gmail.com</a>{" "}
            with the subject “Bitez privacy / deletion”. Do not email passwords
            or payment details. This page is accessible without an account
            through the footer.
          </p>
        </>
      ) : (
        <>
          <h2>How Bitez works</h2>
          <p>
            Bitez helps neighbours coordinate a food run. Hosts arrange
            restaurant orders and collection independently. Bitez is not a
            restaurant, delivery service, payment provider or guarantor. A
            reservation does not confirm a restaurant order or payment.
          </p>
          <h2>Costs and cancellations</h2>
          <p>
            Item prices and delivery shares are estimates. The host counts as
            one participant. The current delivery share is the total fee divided
            by active participants, rounded to cents; agree any rounding
            difference and final restaurant bill directly. You can cancel before
            cutoff while the run is open. After cutoff or locking, coordinate
            with the host at pickup. Hosts must communicate changes responsibly.
          </p>
          <h2>Safe participation</h2>
          <p>
            Use a public collection point. Do not post private home details,
            harass neighbours, create misleading runs, spam, or request
            passwords. Confirm food choices and allergies directly with the
            restaurant. Do not pay strangers in advance without independently
            verifying the arrangement.
          </p>
          <h2>Reports</h2>
          <p>
            Use Report this run, block a host or participant to prevent future
            interactions, or contact{" "}
            <a href="mailto:2002padmakar@gmail.com">2002padmakar@gmail.com</a>.
            Reports are saved for the operator’s review; the pilot does not
            provide round-the-clock moderation or emergency response.
          </p>
          <h2>Pilot availability</h2>
          <p>
            This pilot may be interrupted or changed. Keep an independent record
            of any order you place with a restaurant. Do not rely on Bitez for
            urgent or time-critical arrangements.
          </p>
        </>
      )}
    </article>
  );
}
