import UserDirectory from "@/components/owner/user-directory";
export default function AllUsers({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string;
    tenant?: string;
    q?: string;
    page?: string;
  }>;
}) {
  return <UserDirectory searchParams={searchParams} />;
}
