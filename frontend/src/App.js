import "@/App.css";
import Dashboard from "./components/Dashboard";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <div className="App">
      <Dashboard />
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;