import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './App.css'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={
            <div className="container mx-auto px-4 py-8">
              <h1 className="text-4xl font-bold text-center mb-8">
                Welcome to CreativeChain
              </h1>
              <p className="text-center text-gray-600">
                Decentralized IP Protection & Licensing Platform
              </p>
            </div>
          } />
        </Routes>
      </div>
    </Router>
  )
}

export default App
