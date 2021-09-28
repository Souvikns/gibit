import { useRouter } from "next/router";
import { Box } from "@primer/components";

export default () => {
  const router = useRouter();
  const { org } = router.query;

  return (
    <div>
      <Box color="fg.muted" bg="canvas.subtle" p={3}>
        <h1>{org}</h1>
      </Box>
    </div>
  );
};
