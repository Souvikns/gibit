import { useRouter } from "next/router";

export default () => {
  const router = useRouter();
  const { org } = router.query;
  
  return (
    <div>
      <h1>{org}</h1>
    </div>
  );
};
