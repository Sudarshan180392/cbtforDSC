"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function SuperAdminUsersPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: number, currentRole: string) => {
    const newRole = currentRole === "ADMIN" ? "STUDENT" : "ADMIN";
    const action = newRole === "ADMIN" ? "Grant Admin access to" : "Revoke Admin access from";
    if (!confirm(`${action} this user?`)) return;

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, newRole }),
    });
    if (res.ok) fetchUsers();
  };

  if (role !== "SUPERADMIN") {
    return <div className="flex-1 flex items-center justify-center text-red-600 font-bold text-xl">Access Denied — Superadmin Only</div>;
  }

  return (
    <div className="flex-1 bg-gray-100 p-8 text-black">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Link href="/admin" className="text-blue-600 hover:underline text-sm">← Back to Dashboard</Link>
            <h1 className="text-3xl font-bold text-blue-900 mt-1">User Management</h1>
            <p className="text-gray-500 text-sm">Grant or revoke Admin access to any user.</p>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/admin/login" })} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 text-sm">
            Sign Out
          </button>
        </div>

        <div className="bg-white rounded shadow overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b text-sm text-gray-600">
                <th className="p-4">Name</th>
                <th className="p-4">Roll No / ID</th>
                <th className="p-4">Email</th>
                <th className="p-4">Current Role</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-semibold">{user.name}</td>
                  <td className="p-4 font-mono text-sm">{user.rollNo}</td>
                  <td className="p-4 text-sm text-gray-600">{user.email || "—"}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      user.role === "SUPERADMIN" ? "bg-purple-100 text-purple-800" :
                      user.role === "ADMIN" ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4">
                    {user.role === "SUPERADMIN" ? (
                      <span className="text-gray-400 text-sm">—</span>
                    ) : user.role === "ADMIN" ? (
                      <button onClick={() => handleRoleChange(user.id, user.role)} className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded">
                        Revoke Admin
                      </button>
                    ) : (
                      <button onClick={() => handleRoleChange(user.id, user.role)} className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded">
                        Grant Admin
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="p-6 text-center text-gray-500">Loading users...</div>}
        </div>
      </div>
    </div>
  );
}
