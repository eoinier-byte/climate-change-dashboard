import { Outlet } from 'react-router-dom';
import Footer from './Footer';
import NavBar from './NavBar';
import '../styles/chat-slot.css';
import '../styles/responsive.css';

// The frame around every page: navigation bar, the page itself, then the footer.
//
// #chat-panel-root is an empty, hidden slot for the chat panel (built in a later story).
// To use it: const slot = document.getElementById('chat-panel-root');
//            slot.hidden = false; then createPortal(<ChatPanel />, slot).
// It floats over the right-hand side of the page, so showing it does not move the layout.
export default function Layout() {
  return (
    <div className="app">
      <NavBar />
      <Outlet />
      <Footer />
      <aside id="chat-panel-root" className="chat-slot" aria-label="Chat panel" hidden />
    </div>
  );
}
