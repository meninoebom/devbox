import { useState, useCallback } from "react";
import { WorkshopLayout } from "~/components/layout/WorkshopLayout";
import { useInspector } from "~/components/inspector/InspectorContext";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CodeBlock } from "~/components/inspector/CodeBlock";
import { LogIn, UserPlus, Key, Shield, AlertTriangle } from "lucide-react";

function decodeJwtParts(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    return { header, payload, signature: parts[2] };
  } catch {
    return null;
  }
}

export default function AuthLab() {
  const { inspectRawResponse } = useInspector();

  // Register
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regResult, setRegResult] = useState<any>(null);

  // Login
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [token, setToken] = useState("");
  const [loginResult, setLoginResult] = useState<any>(null);

  // Token inspection
  const [inspectToken, setInspectToken] = useState("");
  const [inspectResult, setInspectResult] = useState<any>(null);
  const [decodedLocal, setDecodedLocal] = useState<any>(null);

  // Me
  const [meResult, setMeResult] = useState<any>(null);

  // Tamper
  const [tamperToken, setTamperToken] = useState("");
  const [tamperResult, setTamperResult] = useState<any>(null);

  const register = useCallback(async () => {
    try {
      const { data, traceId } = await api.auth.register({ username: regUsername, email: regEmail, password: regPassword });
      setRegResult({ success: true, data });
      if (traceId) inspectRawResponse({ status: 200, body: data, traceId, method: "POST", url: "/api/auth/register" });
    } catch (e: any) {
      setRegResult({ success: false, error: e });
      if (e.traceId) inspectRawResponse({ status: e.status, body: e, traceId: e.traceId, method: "POST", url: "/api/auth/register" });
    }
  }, [regUsername, regEmail, regPassword, inspectRawResponse]);

  const login = useCallback(async () => {
    try {
      const { data, traceId } = await api.auth.login({ username: loginUsername, password: loginPassword });
      setLoginResult({ success: true, data });
      const t = data?.access_token || data?.token || "";
      setToken(t);
      setInspectToken(t);
      setTamperToken(t);
      if (traceId) inspectRawResponse({ status: 200, body: data, traceId, method: "POST", url: "/api/auth/login" });
    } catch (e: any) {
      setLoginResult({ success: false, error: e });
      if (e.traceId) inspectRawResponse({ status: e.status, body: e, traceId: e.traceId, method: "POST", url: "/api/auth/login" });
    }
  }, [loginUsername, loginPassword, inspectRawResponse]);

  const fetchMe = useCallback(async () => {
    if (!token) return;
    try {
      const { data, traceId } = await api.auth.me(token);
      setMeResult({ success: true, data });
      if (traceId) inspectRawResponse({ status: 200, body: data, traceId, method: "GET", url: "/api/auth/me" });
    } catch (e: any) {
      setMeResult({ success: false, error: e });
    }
  }, [token, inspectRawResponse]);

  const serverInspect = useCallback(async () => {
    if (!inspectToken) return;
    setDecodedLocal(decodeJwtParts(inspectToken));
    try {
      const { data, traceId } = await api.auth.inspectToken(inspectToken);
      setInspectResult(data);
      if (traceId) inspectRawResponse({ status: 200, body: data, traceId, method: "GET", url: "/api/auth/inspect-token" });
    } catch (e: any) {
      setInspectResult(e);
    }
  }, [inspectToken, inspectRawResponse]);

  const testTampered = useCallback(async () => {
    if (!tamperToken) return;
    try {
      const { data, traceId } = await api.auth.me(tamperToken);
      setTamperResult({ success: true, data });
      if (traceId) inspectRawResponse({ status: 200, body: data, traceId, method: "GET", url: "/api/auth/me" });
    } catch (e: any) {
      setTamperResult({ success: false, error: e });
      if (e.traceId) inspectRawResponse({ status: e.status, body: e, traceId: e.traceId, method: "GET", url: "/api/auth/me" });
    }
  }, [tamperToken, inspectRawResponse]);

  return (
    <WorkshopLayout
      title="Authentication Lab"
      description="Register, login, decode JWTs, and see what happens when you tamper with tokens."
    >
      <Tabs defaultValue="register" className="space-y-6">
        <TabsList className="bg-[#1a1a1a] border border-[#2a2a2a]">
          <TabsTrigger value="register" className="font-mono text-xs"><UserPlus size={14} className="mr-1.5" /> Register</TabsTrigger>
          <TabsTrigger value="login" className="font-mono text-xs"><LogIn size={14} className="mr-1.5" /> Login</TabsTrigger>
          <TabsTrigger value="inspect" className="font-mono text-xs"><Key size={14} className="mr-1.5" /> Token Inspector</TabsTrigger>
          <TabsTrigger value="tamper" className="font-mono text-xs"><AlertTriangle size={14} className="mr-1.5" /> Tamper Mode</TabsTrigger>
        </TabsList>

        {/* Register */}
        <TabsContent value="register" className="space-y-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="pt-6 space-y-3">
              <Input value={regUsername} onChange={(e) => setRegUsername(e.target.value)} placeholder="Username" className="font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
              <Input value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="Email" type="email" className="font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
              <Input value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Password" type="password" className="font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
              <Button onClick={register} className="bg-amber-500 text-black hover:bg-amber-400 font-mono">Register</Button>
              {regResult && (
                <div className={`p-3 rounded border ${regResult.success ? "border-green-800 bg-green-900/20" : "border-red-800 bg-red-900/20"}`}>
                  <CodeBlock language="json">{JSON.stringify(regResult, null, 2)}</CodeBlock>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Login */}
        <TabsContent value="login" className="space-y-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="pt-6 space-y-3">
              <Input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="Username" className="font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
              <Input value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Password" type="password" className="font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
              <div className="flex gap-2">
                <Button onClick={login} className="bg-amber-500 text-black hover:bg-amber-400 font-mono">Login</Button>
                {token && (
                  <Button onClick={fetchMe} variant="outline" className="font-mono border-[#2a2a2a] text-neutral-400">
                    <Shield size={14} className="mr-1.5" /> Who Am I?
                  </Button>
                )}
              </div>
              {loginResult && (
                <CodeBlock language="json">{JSON.stringify(loginResult, null, 2)}</CodeBlock>
              )}
              {meResult && (
                <div className="mt-2">
                  <h4 className="text-xs text-neutral-500 uppercase mb-1">GET /api/auth/me</h4>
                  <CodeBlock language="json">{JSON.stringify(meResult, null, 2)}</CodeBlock>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Token Inspector */}
        <TabsContent value="inspect" className="space-y-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-2">
                <Input value={inspectToken} onChange={(e) => setInspectToken(e.target.value)} placeholder="Paste a JWT here" className="font-mono text-xs bg-[#111] border-[#2a2a2a] text-neutral-300" />
                <Button onClick={serverInspect} className="bg-amber-500 text-black hover:bg-amber-400 font-mono">Decode</Button>
              </div>

              {decodedLocal && (
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-mono text-red-400 mb-1">Header</h4>
                    <div className="p-3 rounded border border-red-800/50 bg-red-900/10">
                      <CodeBlock language="json">{JSON.stringify(decodedLocal.header, null, 2)}</CodeBlock>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-mono text-purple-400 mb-1">Payload</h4>
                    <div className="p-3 rounded border border-purple-800/50 bg-purple-900/10">
                      <CodeBlock language="json">{JSON.stringify(decodedLocal.payload, null, 2)}</CodeBlock>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-mono text-blue-400 mb-1">Signature</h4>
                    <div className="p-3 rounded border border-blue-800/50 bg-blue-900/10">
                      <code className="font-mono text-xs text-blue-300 break-all">{decodedLocal.signature}</code>
                    </div>
                  </div>
                </div>
              )}

              {inspectResult && (
                <div>
                  <h4 className="text-xs text-neutral-500 uppercase mb-1">Server Inspection</h4>
                  <CodeBlock language="json">{JSON.stringify(inspectResult, null, 2)}</CodeBlock>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tamper Mode */}
        <TabsContent value="tamper" className="space-y-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardHeader>
              <CardTitle className="text-sm font-mono flex items-center gap-2 text-amber-400">
                <AlertTriangle size={14} /> Token Tampering
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-neutral-400">
                Edit the token below and try to use it. The server will reject tampered tokens
                because the signature won't match.
              </p>
              <Input
                value={tamperToken}
                onChange={(e) => setTamperToken(e.target.value)}
                className="font-mono text-xs bg-[#111] border-[#2a2a2a] text-neutral-300"
              />
              <Button onClick={testTampered} className="bg-amber-500 text-black hover:bg-amber-400 font-mono">
                Test Token
              </Button>
              {tamperResult && (
                <div className={`p-3 rounded border ${tamperResult.success ? "border-green-800 bg-green-900/20" : "border-red-800 bg-red-900/20"}`}>
                  <CodeBlock language="json">{JSON.stringify(tamperResult, null, 2)}</CodeBlock>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </WorkshopLayout>
  );
}
