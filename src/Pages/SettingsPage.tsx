import {
    Box,
    Button,
    ButtonText,
    HStack,
    Input,
    InputField,
    ScrollView,
    Text,
    VStack,
} from '@gluestack-ui/themed';
import { useEffect, useState } from 'react';
import { Image } from 'react-native';

import {
    addInventoryItem,
    addPublicKey,
    deleteInventoryItem,
    deletePublicKey,
    getInventoryItems,
    getPublicKeys,
    initDatabase,
} from '@/core/db';
import { InventoryRecord, PublicKeyRecord } from '@/core/types';

const BLACK = '#07111d';
const PANEL = '#0f172a';
const YELLOW = '#facc15';
const MUTED = '#cbd5e1';

export default function SettingsPage() {
  const [publicKeys, setPublicKeys] = useState<PublicKeyRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [keyName, setKeyName] = useState('Warehouse Key');
  const [keyValue, setKeyValue] = useState('');
  const [inventoryName, setInventoryName] = useState('Warehouse A');
  const [claimKey, setClaimKey] = useState('warehouse_id');
  const [expectedValue, setExpectedValue] = useState('WH-01');

  const refresh = async () => {
    await initDatabase();
    setPublicKeys(await getPublicKeys());
    setInventory(await getInventoryItems());
  };

  useEffect(() => {
    refresh();
  }, []);

  const saveKey = async () => {
    if (!keyName.trim() || !keyValue.trim()) return;
    await addPublicKey(keyName.trim(), keyValue.trim());
    setKeyName('');
    setKeyValue('');
    refresh();
  };

  const saveInventory = async () => {
    if (!inventoryName.trim() || !claimKey.trim() || !expectedValue.trim()) return;
    await addInventoryItem(inventoryName.trim(), claimKey.trim(), expectedValue.trim());
    setInventoryName('');
    setClaimKey('');
    setExpectedValue('');
    refresh();
  };

  return (
    <ScrollView bg={BLACK} flex={1}>
      <Box px="$4" py="$6">
        <VStack space="lg">
          <HStack alignItems="center" space="sm">
            <Image
              source={require('../assets/msi.png')}
              style={{ width: 46, height: 40 }}
              resizeMode="contain"
              accessibilityLabel="VeriFlow logo"
            />
            <Text color={YELLOW} fontSize="$3xl" fontWeight="900">
              Settings
            </Text>
          </HStack>

          <Box borderWidth={2} borderColor={YELLOW} borderRadius="$xl" bg={PANEL} p="$4">
            <Text color="#f8fafc" fontSize="$xl" fontWeight="800" mb="$4">
              Public Keys
            </Text>

            <VStack space="sm">
              <Input variant="outline" size="lg" borderColor="#334155">
                <InputField
                  value={keyName}
                  onChangeText={setKeyName}
                  placeholder="Key name"
                  placeholderTextColor="#94a3b8"
                  color="#f8fafc"
                />
              </Input>

              <Input variant="outline" size="lg" borderColor="#334155">
                <InputField
                  value={keyValue}
                  onChangeText={setKeyValue}
                  placeholder="Public key PEM"
                  placeholderTextColor="#94a3b8"
                  color="#f8fafc"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  minHeight={120}
                />
              </Input>

              <Button bg={YELLOW} borderRadius="$lg" onPress={saveKey}>
                <ButtonText color={BLACK} fontWeight="900">
                  Add Public Key
                </ButtonText>
              </Button>
            </VStack>

            <VStack mt="$4" space="sm">
              {publicKeys.map(item => (
                <HStack
                  key={item.id}
                  justifyContent="space-between"
                  alignItems="center"
                  borderTopWidth={1}
                  borderTopColor="#334155"
                  pt="$3"
                >
                  <VStack flex={1} space="xs">
                    <Text color="#f8fafc" fontWeight="700">
                      {item.name}
                    </Text>
                    <Text color={MUTED} fontSize="$xs">
                      {item.public_key_string.slice(0, 36)}...
                    </Text>
                  </VStack>

                  <Button
                    size="sm"
                    variant="outline"
                    borderColor="#fca5a5"
                    onPress={() => deletePublicKey(item.id).then(refresh)}
                  >
                    <ButtonText color="#fca5a5">Delete</ButtonText>
                  </Button>
                </HStack>
              ))}
            </VStack>
          </Box>

          <Box borderWidth={2} borderColor={YELLOW} borderRadius="$xl" bg={PANEL} p="$4">
            <Text color="#f8fafc" fontSize="$xl" fontWeight="800" mb="$4">
              Inventory Rules
            </Text>

            <VStack space="sm">
              <Input variant="outline" size="lg" borderColor="#334155">
                <InputField
                  value={inventoryName}
                  onChangeText={setInventoryName}
                  placeholder="Inventory name"
                  placeholderTextColor="#94a3b8"
                  color="#f8fafc"
                />
              </Input>

              <Input variant="outline" size="lg" borderColor="#334155">
                <InputField
                  value={claimKey}
                  onChangeText={setClaimKey}
                  placeholder="Claim key"
                  placeholderTextColor="#94a3b8"
                  color="#f8fafc"
                />
              </Input>

              <Input variant="outline" size="lg" borderColor="#334155">
                <InputField
                  value={expectedValue}
                  onChangeText={setExpectedValue}
                  placeholder="Expected value"
                  placeholderTextColor="#94a3b8"
                  color="#f8fafc"
                />
              </Input>

              <Button bg={YELLOW} borderRadius="$lg" onPress={saveInventory}>
                <ButtonText color={BLACK} fontWeight="900">
                  Add Inventory Rule
                </ButtonText>
              </Button>
            </VStack>

            <VStack mt="$4" space="sm">
              {inventory.map(item => (
                <HStack
                  key={item.id}
                  justifyContent="space-between"
                  alignItems="center"
                  borderTopWidth={1}
                  borderTopColor="#334155"
                  pt="$3"
                >
                  <VStack flex={1} space="xs">
                    <Text color="#f8fafc" fontWeight="700">
                      {item.inventory_name}
                    </Text>
                    <Text color={MUTED} fontSize="$xs">
                      {item.matching_claim_key} = {item.expected_value}
                    </Text>
                  </VStack>

                  <Button
                    size="sm"
                    variant="outline"
                    borderColor="#fca5a5"
                    onPress={() => deleteInventoryItem(item.id).then(refresh)}
                  >
                    <ButtonText color="#fca5a5">Delete</ButtonText>
                  </Button>
                </HStack>
              ))}
            </VStack>
          </Box>
        </VStack>
      </Box>
    </ScrollView>
  );
}
