// Tests for the "Share image" button (CCD-392). The picture-making library is a fake here:
// a real picture needs a real browser, so the picture itself is checked by hand (see the PR).
import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toPng } from 'html-to-image';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShareImage from './ShareImage';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));

const PICTURE = 'data:image/png;base64,AAA';

// A page with something to photograph and the button, like the stripes or the map
function Harness({ filename = 'my-picture' }) {
  const ref = useRef(null);
  return (
    <>
      <div ref={ref} data-testid="target">
        Something to photograph
      </div>
      <ShareImage targetRef={ref} filename={filename} />
    </>
  );
}

// Every file the page "downloaded": the name and the picture it was given
let downloads;

beforeEach(() => {
  toPng.mockReset();
  downloads = [];
  // jsdom cannot download, so clicking the hidden link is recorded instead
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    downloads.push({ name: this.download, href: this.href });
  });
});

afterEach(() => vi.restoreAllMocks());

describe('ShareImage', () => {
  it('says nothing until the button is clicked', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Share image' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
    expect(toPng).not.toHaveBeenCalled();
  });

  it('makes a picture of the target and downloads it as a PNG with the given name', async () => {
    toPng.mockResolvedValue(PICTURE);
    const user = userEvent.setup();
    render(<Harness filename="warming-stripes-cork" />);

    await user.click(screen.getByRole('button', { name: 'Share image' }));

    expect(await screen.findByText('Image downloaded.')).toBeTruthy();
    expect(toPng.mock.calls[0][0]).toBe(screen.getByTestId('target'));
    expect(downloads).toEqual([{ name: 'warming-stripes-cork.png', href: PICTURE }]);
  });

  it('asks for a white background and a sharp picture, and leaves out anything marked for the screen only', async () => {
    toPng.mockResolvedValue(PICTURE);
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Share image' }));
    await screen.findByText('Image downloaded.');

    const options = toPng.mock.calls[0][1];
    expect(options.backgroundColor).toBe('#ffffff');
    expect(options.pixelRatio).toBe(2);

    const screenOnly = document.createElement('div');
    screenOnly.setAttribute('data-share-exclude', '');
    expect(options.filter(screenOnly)).toBe(false);
    expect(options.filter(document.createElement('div'))).toBe(true);
    expect(options.filter(document.createTextNode('A label'))).toBe(true);
  });

  it('is switched off, and says so, while the picture is being made', async () => {
    let finish;
    toPng.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Share image' }));
    expect(screen.getByRole('button', { name: 'Share image' }).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('Preparing the image…');

    finish(PICTURE);
    expect(await screen.findByText('Image downloaded.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share image' }).disabled).toBe(false);
  });

  it('does not leave the hidden download link on the page', async () => {
    toPng.mockResolvedValue(PICTURE);
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Share image' }));
    await screen.findByText('Image downloaded.');

    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('says it could not make the picture, and downloads nothing, when the library fails', async () => {
    toPng.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Share image' }));

    expect(await screen.findByText("Couldn't make the image. Please try again.")).toBeTruthy();
    expect(downloads).toEqual([]);
    expect(screen.getByRole('button', { name: 'Share image' }).disabled).toBe(false);
  });

  it('uses the label it is given', () => {
    function Labelled() {
      const ref = useRef(null);
      return <ShareImage targetRef={ref} filename="x" label="Save the map as a picture" />;
    }
    render(<Labelled />);
    expect(screen.getByRole('button', { name: 'Save the map as a picture' })).toBeTruthy();
  });

  it('says it could not make the picture if there is nothing to photograph', async () => {
    function Nothing() {
      const ref = useRef(null); // never put on an element
      return <ShareImage targetRef={ref} filename="x" />;
    }
    const user = userEvent.setup();
    render(<Nothing />);

    await user.click(screen.getByRole('button', { name: 'Share image' }));

    expect(screen.getByRole('status').textContent).toBe("Couldn't make the image. Please try again.");
    expect(toPng).not.toHaveBeenCalled();
  });
});
