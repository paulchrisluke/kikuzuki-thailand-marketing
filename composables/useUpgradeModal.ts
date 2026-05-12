const upgradeModalState = useState('upgrade-modal', () => ({
  isOpen: false,
  feature: '' as string
}))

export const useUpgradeModal = () => {
  const open = (feature: string) => {
    upgradeModalState.value.feature = feature
    upgradeModalState.value.isOpen = true
  }

  const close = () => {
    upgradeModalState.value.isOpen = false
    upgradeModalState.value.feature = ''
  }

  return {
    isOpen: computed(() => upgradeModalState.value.isOpen),
    feature: computed(() => upgradeModalState.value.feature),
    open,
    close
  }
}
