import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import { ROUTES } from '../routes';
import * as api from '../services/api';
import { renderWithRouter } from '../test/renderWithRouter';
import DownloadReport from './DownloadReport';

// Tests for the Download PDF button (CCD-408). The API is a fake and so is the browser's file saving.
vi.mock('../services/api');

const apiError = (status) => Object.assign(new Error(`API error ${status}`), { name: 'ApiError', status });
const file = { blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }), filename: 'cork-climate-report.pdf' };

function renderButton({ status = 'signedIn', scenarios } = {}) {
  renderWithRouter(
    <AuthContext.Provider value={{ user: status === 'signedIn' ? { username: 'ronel' } : null, status }}>
      <DownloadReport slug="cork" scenarios={scenarios} />
    </AuthContext.Provider>,
    { url: '/county/cork', path: '/county/:slug' },
  );
}

const downloadButton = () => screen.getByRole('button', { name: /download pdf|preparing pdf|try again/i });

let saved; // the links "clicked" to save a file
let clickSpy;

beforeEach(() => {
  vi.resetAllMocks();
  saved = [];
  URL.createObjectURL = vi.fn(() => 'blob:fake-url');
  URL.revokeObjectURL = vi.fn();
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    saved.push({ href: this.href, name: this.download });
  });
});

afterEach(() => {
  clickSpy.mockRestore();
});

describe('DownloadReport', () => {
  it('offers a login link to a visitor who is not signed in, and asks the server nothing', () => {
    renderButton({ status: 'signedOut' });
    const link = screen.getByRole('link', { name: 'Log in to download the PDF report' });
    expect(link.getAttribute('href')).toBe(ROUTES.login);
    expect(screen.queryByRole('button')).toBeNull();
    expect(api.getReport).not.toHaveBeenCalled();
  });

  it('shows nothing while the site checks who is signed in', () => {
    renderButton({ status: 'loading' });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('starts on the first scenario ticked on the page, and offers the three scenarios', () => {
    renderButton({ scenarios: ['rcp85'] });
    const choice = screen.getByLabelText('Scenario in the report');
    expect(choice.value).toBe('rcp85');
    expect(Array.from(choice.options).map((option) => option.textContent)).toEqual([
      'RCP2.6: If the world cuts emissions',
      'RCP4.5: Middle path',
      'RCP8.5: If nothing is done',
    ]);
  });

  it('asks for the county and the scenario, then saves the file under the name from the server', async () => {
    api.getReport.mockResolvedValue(file);
    const user = userEvent.setup();
    renderButton({ scenarios: ['rcp26', 'rcp85'] });

    await user.click(downloadButton());

    expect(api.getReport).toHaveBeenCalledWith('cork', 'rcp26');
    await waitFor(() => expect(saved).toEqual([{ href: 'blob:fake-url', name: 'cork-climate-report.pdf' }]));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends the scenario the visitor chose', async () => {
    api.getReport.mockResolvedValue(file);
    const user = userEvent.setup();
    renderButton();

    await user.selectOptions(screen.getByLabelText('Scenario in the report'), 'rcp85');
    await user.click(downloadButton());

    expect(api.getReport).toHaveBeenCalledWith('cork', 'rcp85');
  });

  it('shows a message and disables the button while the report is made, so it cannot be clicked twice', async () => {
    let finish;
    api.getReport.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    renderButton();

    await user.click(downloadButton());

    expect(downloadButton().textContent).toBe('Preparing PDF…');
    expect(downloadButton().disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/Making your report/);
    await user.click(downloadButton());
    expect(api.getReport).toHaveBeenCalledTimes(1);

    finish(file);
    await waitFor(() => expect(downloadButton().textContent).toBe('Download PDF'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each([
    [403, 'Your session has ended. Please log in again to download the report.'],
    [404, 'There is no report for this county.'],
    [500, 'We could not make the report. Please try again.'],
    [null, 'We could not reach the server. Check your connection and try again.'],
  ])('says what went wrong for status %s, and offers to try again', async (status, text) => {
    api.getReport.mockRejectedValue(apiError(status));
    const user = userEvent.setup();
    renderButton();

    await user.click(downloadButton());

    expect((await screen.findByRole('alert')).textContent).toBe(text);
    expect(downloadButton().textContent).toBe('Try again');
    expect(downloadButton().disabled).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it('downloads after a failure when the button is pressed again, and clears the message', async () => {
    api.getReport.mockRejectedValueOnce(apiError(500)).mockResolvedValueOnce(file);
    const user = userEvent.setup();
    renderButton();

    await user.click(downloadButton());
    await screen.findByRole('alert');
    await user.click(downloadButton());

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(api.getReport).toHaveBeenCalledTimes(2);
  });
});
