import { AgentApp } from '@/components/agent-app';

export default async function Page({ params }: { params: Promise<{ contact: string }> }) {
  const { contact } = await params;
  return <AgentApp view="chat" active={contact} />;
}
