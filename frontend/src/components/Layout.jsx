import { Outlet } from 'react-router-dom';
import ChatPanel from './ChatPanel';
import Footer from './Footer';
import NavBar from './NavBar';
import '../styles/chat-slot.css';
import '../styles/responsive.css';

// The frame around every page: navigation bar, the page itself, then the footer.
//
// ChatPanel (CCD-386) adds the "Ask Boreas" button and fills Ronel's chat slot (CCD-403):
// <aside id="chat-panel-root" class="chat-slot">, hidden and empty until the chat is opened.
// It floats over the right-hand side of the page, so opening it does not move the layout.
export default function Layout() {
  return (
    <div className="app">
      <NavBar />
      <Outlet />
      <Footer />
      <ChatPanel />
    </div>
  );
}