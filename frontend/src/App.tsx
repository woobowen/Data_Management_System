import { DeskScene } from './components/desk-scene';
import { SurveyProvider } from './state/survey-context';

export default function App() {
  return (
    <SurveyProvider>
      <DeskScene />
    </SurveyProvider>
  );
}
