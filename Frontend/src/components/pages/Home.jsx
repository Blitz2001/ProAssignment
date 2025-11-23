import React from 'react';
import LandingPage from './LandingPage.jsx';

// Thin wrapper to provide a distinct "Home" page entry
// while reusing the existing LandingPage UI.
const Home = (props) => <LandingPage {...props} />;

export default Home;


