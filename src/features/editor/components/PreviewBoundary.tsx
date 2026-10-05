"use client";
import { Component, type ReactNode } from "react";
/** A preview chunk/render failure must not unmount the source or save controller. */
export class PreviewBoundary extends Component<{children:ReactNode}, {failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<p role="status">Preview unavailable; source editing and saving remain available.</p>:this.props.children;}
}
