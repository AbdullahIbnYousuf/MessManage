import { signOut } from "@/lib/auth";

export default function RejectedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 w-full max-w-md text-center">
        <div className="text-5xl mb-6">🚫</div>
        <h1 className="text-xl font-bold text-white mb-3">Request Rejected</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          Your membership request was not approved. If you think this is a
          mistake, please contact a household admin directly.
        </p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/auth/login" });
          }}
        >
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
