import {
    Box,
    Button,
    ButtonText,
    HStack,
    Heading,
    Pressable,
    Text,
    VStack,
} from '@gluestack-ui/themed';
import { router } from 'expo-router';

const BLACK = '#07111d';
const PANEL = '#0f172a';
const YELLOW = '#facc15';
const MUTED = '#cbd5e1';

export default function HomePage() {
  return (
    <Box flex={1} bg="$backgroundDark950" px="$4" py="$6">
      <VStack space="lg" flex={1} justifyContent="center">
        <VStack space="xs">
          <Heading size="3xl" color={YELLOW} fontWeight="900">
            VeriFlow
          </Heading>
          <Text fontSize="$lg" color={MUTED}>
            Industrial offline scanner for field operations
          </Text>
        </VStack>

        <Box borderWidth={2} borderColor={YELLOW} borderRadius="$xl" bg={PANEL} p="$5">
          <Text color="#f8fafc" fontSize="$2xl" fontWeight="800" mb="$4">
            Quick Actions
          </Text>

          <VStack space="md">
            <Button
              size="lg"
              bg={YELLOW}
              borderRadius="$lg"
              onPress={() => router.push('/scanner')}
            >
              <ButtonText color={BLACK} fontWeight="900">
                Open Scanner
              </ButtonText>
            </Button>

            <Pressable onPress={() => router.push('/settings')}>
              <Box
                borderWidth={2}
                borderColor={YELLOW}
                borderRadius="$lg"
                py="$4"
                alignItems="center"
                justifyContent="center"
                bg="#0b1220"
              >
                <Text color={YELLOW} fontSize="$lg" fontWeight="800">
                  Manage Keys
                </Text>
              </Box>
            </Pressable>
          </VStack>
        </Box>

        <HStack space="sm" justifyContent="space-between" alignItems="center">
          <Text color={YELLOW} fontSize="$sm" fontWeight="700">
            Status: Ready
          </Text>
          <Text color={MUTED} fontSize="$sm">
            Offline mode
          </Text>
        </HStack>
      </VStack>
    </Box>
  );
}
