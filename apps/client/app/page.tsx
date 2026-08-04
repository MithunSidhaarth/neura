import NeuralScene from "@/components/Scene";
import GlassHero from "@/components/UI/GlassHero";
import Cursor from "@/components/UI/Cursor";
import NeuronTooltip from "@/components/UI/NeuronTooltip";
import Breadcrumb from "@/components/UI/Breadcrumb";
import Dock from "@/components/UI/Dock";
import ChatPanel from "@/components/UI/ChatPanel";
import CommandPalette from "@/components/UI/CommandPalette";
import ContextMenu from "@/components/UI/ContextMenu";

export default function Home() {

    return (
        <>
            <NeuralScene />
            <GlassHero />
            <Breadcrumb />
            <Dock />
            <ChatPanel />
            <CommandPalette />
            <ContextMenu />
            <NeuronTooltip />
            <Cursor />
        </>
    );

}
