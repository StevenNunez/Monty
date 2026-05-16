export default function DashboardSkeleton() {
  return (
    <div className="container mx-auto max-w-lg p-4 pt-8 pb-32 animate-pulse">
      {/* Main card */}
      <div className="mb-8 rounded-[2.5rem] bg-indigo-200 h-52" />

      {/* 2-col grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-200 rounded-3xl h-24" />
        <div className="bg-gray-200 rounded-3xl h-24" />
      </div>

      {/* Daily progress card */}
      <div className="bg-gray-200 rounded-[2rem] h-32 mb-4" />

      {/* Progress card */}
      <div className="bg-gray-200 rounded-[2rem] h-28" />
    </div>
  );
}
