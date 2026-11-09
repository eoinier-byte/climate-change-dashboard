// Shown by every page that is not built yet, so opening it never gives an error.
export default function ComingSoon({ title }) {
  return (
    <main>
      <h1>{title}</h1>
      <p>Coming soon.</p>
    </main>
  );
}
