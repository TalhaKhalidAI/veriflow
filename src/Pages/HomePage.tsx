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
import { Image } from 'react-native';

const BLACK = '#07111d';
const PANEL = '#0f172a';
const YELLOW = '#facc15';
const MUTED = '#cbd5e1';

export default function HomePage() {
  return (
    <Box flex={1} bg="$backgroundDark950" px="$4" pt="$0" pb="$16" justifyContent="center">
      <VStack
        space="lg"
        width="100%"
        maxWidth={520}
        alignSelf="center"
      >
        <HStack alignItems="center" space="md">
          <Image
            source={require('../assets/msi_white.png')}
            style={{ width: 72, height: 64 }}
            resizeMode="contain"
            accessibilityLabel="VeriFlow logo"
          />
          <VStack space="xs" flex={1}>
            <Heading size="3xl" color={YELLOW} fontWeight="900">
              VeriFlow
            </Heading>
            <Text fontSize="$md" color={MUTED}>
              Industrial offline scanner for field operations
            </Text>
          </VStack>
        </HStack>

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
