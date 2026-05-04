import DealsList from "./components/DealsList";

export default function App({ pageData }) {
  const recordId = pageData?.EntityId || null;
  return (
    <div className="app">
      <DealsList initialRecordId={recordId} />
    </div>
  );
}
