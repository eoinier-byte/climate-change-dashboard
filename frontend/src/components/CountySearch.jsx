import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COUNTIES, findCounty } from '../data/counties';
import { countyPath } from '../routes';
import '../styles/county-search.css';

// Type or pick a county, then press Go (or Enter) to open its dashboard.
export default function CountySearch() {
  const inputId = useId();
  const listId = useId();
  const errorId = useId();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const county = findCounty(text);
    if (!county) {
      setError('Choose one of the 26 counties from the list.');
      return;
    }
    setError('');
    navigate(countyPath(county.slug));
  }

  return (
    <form className="county-search" onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId} className="county-search__label">
        Find a county
      </label>
      <div className="county-search__row">
        <input
          id={inputId}
          className="county-search__input"
          type="text"
          list={listId}
          value={text}
          autoComplete="off"
          placeholder="e.g. Cork"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setError('');
          }}
        />
        <datalist id={listId}>
          {COUNTIES.map((county) => (
            <option key={county.slug} value={county.name} />
          ))}
        </datalist>
        <button type="submit" className="btn">
          Go
        </button>
      </div>
      {error && (
        <p id={errorId} className="county-search__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
