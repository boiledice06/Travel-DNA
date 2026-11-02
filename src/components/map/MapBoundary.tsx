import React from 'react';
import { Text, View } from 'react-native';
import { ui } from '../common/ui.styles';
import { Button } from '../common/UI';
export class MapBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <View style={[ui.screen, { justifyContent: 'center', padding: 28, gap: 12 }]}>
        <Text style={ui.subtitle}>지도를 표시할 수 없어요</Text>
        <Text style={ui.body}>아래 추천 목록에서 장소를 계속 탐색할 수 있어요.</Text>
        <Button title="지도 다시 시도" secondary onPress={() => this.setState({ failed: false })} />
      </View>
    ) : (
      this.props.children
    );
  }
}
