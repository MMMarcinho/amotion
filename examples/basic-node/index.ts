import { Amotion } from "amotion";
import { policyToSystemHint } from "@amotion/adapters";

const amotion = new Amotion();

const messages = [
  "我现在真的有点崩溃，不知道该怎么办",
  "我想认真规划一下这个项目，看看能不能做成开源工具",
  "你确定吗？我感觉这个方案风险很大"
];

for (const message of messages) {
  const result = await amotion.process({ message });

  console.log("\n---");
  console.log("message:", message);
  console.log("signal:", JSON.stringify(result.signal, null, 2));
  console.log("state:", JSON.stringify(result.state, null, 2));
  console.log("policy:", JSON.stringify(result.policy, null, 2));
  console.log("system hint:\n" + policyToSystemHint(result.policy));
}
