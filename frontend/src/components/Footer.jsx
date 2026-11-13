import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';
import '../styles/footer.css';

// Credits and licences match DATA_SOURCES.md section 4 (the combined footer text).
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>
          <Link to={ROUTES.about}>About this dashboard</Link>
        </p>
        <p>
          The dashboard shows projections from simplified climate models. They are not forecasts.
        </p>
        <p>
          Climate projections: Met Éireann TRANSLATE via{' '}
          <a href="https://www.climateireland.ie/">EPA Climate Ireland</a> (
          <a href="https://doi.org/10.3389/fclim.2023.1166828">O&apos;Brien &amp; Nolan, 2023</a>
          ). Sea level: contains Met Office UKCP18 data licensed under the{' '}
          <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">
            Open Government Licence v3.0
          </a>
          . County boundaries: © Tailte Éireann, Counties – National Statutory Boundaries – 2019 –
          Generalised 20m, licensed under{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
        </p>
      </div>
    </footer>
  );
}
