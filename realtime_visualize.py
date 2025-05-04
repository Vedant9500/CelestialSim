import matplotlib.pyplot as plt
import matplotlib.animation as animation
import pandas as pd
import numpy as np
from mpl_toolkits.mplot3d import Axes3D
from matplotlib.widgets import Button, Slider
import matplotlib.text as mtext
import time
import os
import atexit

def load_realtime_data(filename):
    """Load simulation data from CSV file, returning None if the file doesn't exist yet"""
    try:
        data = pd.read_csv(filename)
        return data
    except (FileNotFoundError, pd.errors.EmptyDataError):
        return None

def create_shutdown_signal():
    """Create a shutdown signal file to tell the C++ program to exit"""
    with open("shutdown_signal.txt", "w") as f:
        f.write("shutdown")

def remove_shutdown_signal():
    """Remove the shutdown signal file if it exists"""
    if os.path.exists("shutdown_signal.txt"):
        os.remove("shutdown_signal.txt")

def create_realtime_animation():
    """Create 3D animation of the N-body simulation in real-time"""
    # Constants
    DATA_FILE = "nbody_realtime_data.csv"
    REFRESH_INTERVAL = 100  # milliseconds
    TRAIL_LENGTH = 20
    
    # Clean up any previous shutdown signals
    remove_shutdown_signal()
    
    # Register the shutdown signal creation for when the program exits
    atexit.register(create_shutdown_signal)
    
    # Create figure and 3D axis
    fig = plt.figure(figsize=(12, 10))
    
    # Add control panel below the main plot
    ax_main = plt.subplot2grid((6, 1), (0, 0), rowspan=5, projection='3d')
    ax_controls = plt.subplot2grid((6, 1), (5, 0))
    ax_controls.axis('off')  # Hide the axis for the controls area
    
    # Initialize color map (will be assigned once we know number of bodies)
    colors = plt.cm.jet(np.linspace(0, 1, 10))  # Default colors
    
    # Initialize data structures
    scatters = []
    trails = []
    body_data = None
    history = []  # Will be list of lists, each inner list contains positions for one body
    
    # Add information text elements
    status_text = ax_main.text2D(0.5, 0.95, "Waiting for simulation data...", transform=ax_main.transAxes, ha='center')
    
    # Controls for view adjustments
    ax_main.set_xlabel('X')
    ax_main.set_ylabel('Y')
    ax_main.set_zlabel('Z')
    ax_main.set_title('N-Body Simulation (Real-time)')
    
    # Control variables
    autoscale = True
    center_on_sun = True
    display_trails = True
    pause_updates = False
    
    def init_visualization_objects(num_bodies):
        nonlocal colors, scatters, trails, history
        
        # Set up color map for different bodies
        colors = plt.cm.jet(np.linspace(0, 1, num_bodies))
        
        # Clear any existing objects
        for scatter in scatters:
            scatter.remove()
        for trail in trails:
            trail.remove()
            
        scatters = []
        trails = []
        
        # Create new visualization objects
        for i in range(num_bodies):
            # Create scatter plots for bodies
            scatter = ax_main.scatter([], [], [], s=50, c=[colors[i]])
            scatters.append(scatter)
            
            # Create lines for trails
            trail, = ax_main.plot([], [], [], '-', linewidth=1, alpha=0.3, c=colors[i])
            trails.append(trail)
        
        # Reset history
        history = [[] for _ in range(num_bodies)]
    
    def update_visualization():
        nonlocal body_data, history
        
        if body_data is None:
            return
        
        num_bodies = len(body_data)
        
        # Initialize visualization objects if needed
        if not scatters or len(scatters) != num_bodies:
            init_visualization_objects(num_bodies)
        
        # Get position ranges for scaling
        x_min, x_max = body_data['x'].min(), body_data['x'].max()
        y_min, y_max = body_data['y'].min(), body_data['y'].max()
        z_min, z_max = body_data['z'].min(), body_data['z'].max()
        
        if center_on_sun:
            # For solar system, center on the Sun (assuming body_id 0)
            sun_data = body_data[body_data['body_id'] == 0]
            if not sun_data.empty:
                sun_x, sun_y, sun_z = sun_data['x'].values[0], sun_data['y'].values[0], sun_data['z'].values[0]
                x_min -= sun_x
                x_max -= sun_x
                y_min -= sun_y
                y_max -= sun_y
                z_min -= sun_z
                z_max -= sun_z
        
        # Get the maximum range for equal aspect ratio
        if autoscale:
            max_range = max(x_max - x_min, y_max - y_min, z_max - z_min) / 2
            if max_range > 0:  # Prevent division by zero or negative values
                mid_x = (x_max + x_min) / 2
                mid_y = (y_max + y_min) / 2
                mid_z = (z_max + z_min) / 2
                
                ax_main.set_xlim(mid_x - max_range, mid_x + max_range)
                ax_main.set_ylim(mid_y - max_range, mid_y + max_range)
                ax_main.set_zlim(mid_z - max_range, mid_z + max_range)
        
        # Get mass for scaling point sizes
        max_mass = body_data['mass'].max()
        min_mass = body_data['mass'].min()
        
        # Update each body's visualization
        for i, body_id in enumerate(body_data['body_id']):
            row = body_data[body_data['body_id'] == body_id].iloc[0]
            x, y, z = row['x'], row['y'], row['z']
            
            # Apply sun-centering if enabled
            if center_on_sun and 'Sun' in body_data['name'].values:
                sun_data = body_data[body_data['name'] == 'Sun']
                if not sun_data.empty:
                    sun_x, sun_y, sun_z = sun_data['x'].values[0], sun_data['y'].values[0], sun_data['z'].values[0]
                    x, y, z = x - sun_x, y - sun_y, z - sun_z
            
            # Update body position
            scatters[i]._offsets3d = ([x], [y], [z])
            
            # Update mass-based size
            mass = row['mass']
            # Scale size logarithmically between 20 and 200 based on mass
            size = 20 + 180 * np.log(mass / min_mass) / np.log(max_mass / min_mass) if max_mass > min_mass else 50
            scatters[i].set_sizes([size])
            
            # Update trail
            if display_trails:
                history[i].append((x, y, z))
                if len(history[i]) > TRAIL_LENGTH:
                    history[i] = history[i][-TRAIL_LENGTH:]
                
                if history[i]:
                    xs, ys, zs = zip(*history[i])
                    trails[i].set_data(xs, ys)
                    trails[i].set_3d_properties(zs)
        
        # Update legend with names
        if len(ax_main.get_legend_handles_labels()[0]) == 0:  # Only create legend if it doesn't exist
            body_names = [row['name'] for _, row in body_data.iterrows()]
            legend_elements = [plt.Line2D([0], [0], marker='o', color='w', 
                                         label=name,
                                         markerfacecolor=colors[i], markersize=8)
                              for i, name in enumerate(body_names)]
            ax_main.legend(handles=legend_elements, loc='upper right')
        
        # Update status text
        status_text.set_text(f"Simulating {num_bodies} bodies in real-time")
    
    def load_and_update():
        nonlocal body_data
        
        if pause_updates:
            return
        
        # Check for shutdown signal from C++ side
        if os.path.exists("shutdown_signal.txt"):
            plt.close(fig)  # Close the figure if signaled by C++ program
            return
            
        # Load the latest data
        new_data = load_realtime_data(DATA_FILE)
        if new_data is not None:
            body_data = new_data
            update_visualization()
    
    def animate(frame):
        load_and_update()
        return scatters + trails
    
    # Add control buttons at bottom of window
    button_width = 0.18
    button_height = 0.05
    button_y_pos = 0.25
    
    ax_toggle_autoscale = plt.axes([0.05, button_y_pos, button_width, button_height])
    ax_center_sun = plt.axes([0.29, button_y_pos, button_width, button_height])
    ax_toggle_trails = plt.axes([0.53, button_y_pos, button_width, button_height])
    ax_toggle_pause = plt.axes([0.77, button_y_pos, button_width, button_height])
    
    # Create buttons
    btn_autoscale = Button(ax_toggle_autoscale, 'Autoscale: ON')
    btn_center_sun = Button(ax_center_sun, 'Center: ON')
    btn_trails = Button(ax_toggle_trails, 'Trails: ON')
    btn_pause = Button(ax_toggle_pause, 'Pause')
    
    # Add callback functions
    def toggle_autoscale(event):
        nonlocal autoscale
        autoscale = not autoscale
        btn_autoscale.label.set_text('Autoscale: ' + ('ON' if autoscale else 'OFF'))
        fig.canvas.draw_idle()
    
    def toggle_sun_center(event):
        nonlocal center_on_sun
        center_on_sun = not center_on_sun
        btn_center_sun.label.set_text('Center: ' + ('ON' if center_on_sun else 'OFF'))
        # Reset history to avoid jumps in trails
        for h in history:
            h.clear()
        fig.canvas.draw_idle()
    
    def toggle_trails(event):
        nonlocal display_trails
        display_trails = not display_trails
        btn_trails.label.set_text('Trails: ' + ('ON' if display_trails else 'OFF'))
        # Show/hide trails
        for trail in trails:
            trail.set_visible(display_trails)
        fig.canvas.draw_idle()
    
    def toggle_pause(event):
        nonlocal pause_updates
        pause_updates = not pause_updates
        btn_pause.label.set_text('Resume' if pause_updates else 'Pause')
        fig.canvas.draw_idle()
    
    # Connect callbacks to buttons
    btn_autoscale.on_clicked(toggle_autoscale)
    btn_center_sun.on_clicked(toggle_sun_center)
    btn_trails.on_clicked(toggle_trails)
    btn_pause.on_clicked(toggle_pause)
    
    # Handle window close event
    def on_close(event):
        print("Visualization window closed, signaling simulation to stop...")
        create_shutdown_signal()
    
    fig.canvas.mpl_connect('close_event', on_close)
    
    # Start Animation
    ani = animation.FuncAnimation(fig, animate, interval=REFRESH_INTERVAL, blit=False)
    
    plt.tight_layout()
    plt.subplots_adjust(bottom=0.15)  # Make room for controls at bottom
    plt.show()
    
    # Create shutdown signal when the window is closed
    create_shutdown_signal()

if __name__ == "__main__":
    # Check if this is run directly
    try:
        print("Starting real-time N-body simulation visualization...")
        print("This will read continuously from 'nbody_realtime_data.csv'")
        print("Close the visualization window to stop the simulation.")
        create_realtime_animation()
    except Exception as e:
        print(f"Error: {e}")
        # Ensure we create the shutdown signal even if there's an error
        create_shutdown_signal()