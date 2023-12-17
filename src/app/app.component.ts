import { AfterViewInit, Component, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
gsap.registerPlugin(MotionPathPlugin)

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit {
  @ViewChild('animatedBorder') animatedBorder: any;
  @ViewChild('animatedBorderContainer') animatedBorderContainer: any;

  ngAfterViewInit(): void {
    this.resetAnimatedBorder();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (this.divExists) this.resetAnimatedBorder();
  }

  divExists = false;
  dots: any[] = [];
  resetAnimatedBorder() { 
    let abc = this.animatedBorderContainer.nativeElement;
    
    let newWidth = abc.offsetWidth - 1;
    let newHeight = abc.offsetHeight - 1;
    let d = `M0 0 L ${newWidth} 0 L ${newWidth} ${newHeight} L 0 ${newHeight} Z`
    let roundedPath = this.roundPathCorners(d, 10, false);
    let ab = this.animatedBorder.nativeElement;
    ab.setAttribute('d', roundedPath);

    // remove all existing dots from dom 
    this.dots.forEach(dot => { dot.remove(); });

    const numOfDots: number = 40;  // starts bogging down around 100+ dots

    // Create the dots and append them to the body or specific container
    for (let i = 0; i < numOfDots; i++) { 
      let dot = document.createElement('div');
      dot.classList.add('dot'); 
      dot.innerHTML = '.'; 
      let maxOpacity = 0.3;
      let fade = maxOpacity - (maxOpacity * (i / numOfDots)); 
      dot.style.backgroundColor = 'rgba(255, 255, 255, ' + fade + ')';
      abc.appendChild(dot);
 
      gsap.to(dot, {
        duration: 10,
        repeat: -1,  
        ease: "linear",
        motionPath: {
          path: "#svg-rect",
          align: "#svg-rect",
        },
        delay: i * 0.015,
      });

      // fade in after the dots gets past the first corner
      // so there isn't a bright spot in the top, left corner
      // where they all bunch up 
      gsap.to(dot, { opacity: 1, delay: .1 + i * 0.01, });

      this.dots.push(dot);
    }

    this.divExists = true;
  }

  roundPathCorners(pathString: string, radius: any, useFractionalRadius: boolean) {

    return roundPathCorners(pathString, radius, useFractionalRadius);

    /**
    * SVG Path rounding function. Takes an input path string and outputs a path
    * string where all line-line corners have been rounded. Only supports absolute
    * commands at the moment.
    * 
    * @param pathString The SVG input path
    * @param radius The amount to round the corners, either a value in the SVG 
    *               coordinate space, or, if useFractionalRadius is true, a value
    *               from 0 to 1.
    * @param useFractionalRadius If true, the curve radius is expressed as a
    *               fraction of the distance between the point being curved and
    *               the previous and next points.
    * @returns A new SVG path string with the rounding
    */
    function roundPathCorners(pathString: string, radius: any, useFractionalRadius: boolean) {
      function moveTowardsLength(movingPoint: { x: any; y: any; }, targetPoint: { x: any; y: any; }, amount: number) {
        let width = (targetPoint.x - movingPoint.x);
        let height = (targetPoint.y - movingPoint.y);

        let distance = Math.sqrt(width * width + height * height);

        return moveTowardsFractional(movingPoint, targetPoint, Math.min(1, amount / distance));
      }
      function moveTowardsFractional(movingPoint: { x: any; y: any; }, targetPoint: { x: any; y: any; }, fraction: number) {
        return {
          x: movingPoint.x + (targetPoint.x - movingPoint.x) * fraction,
          y: movingPoint.y + (targetPoint.y - movingPoint.y) * fraction
        };
      }

      // Adjusts the ending position of a command
      function adjustCommand(cmd: any[], newPoint: { x: any; y: any; }) {
        if (cmd.length > 2) {
          cmd[cmd.length - 2] = newPoint.x;
          cmd[cmd.length - 1] = newPoint.y;
        }
      }

      // Gives an {x, y} object for a command's ending position
      function pointForCommand(cmd: any[]): any {
        return {
          x: parseFloat(cmd[cmd.length - 2]),
          y: parseFloat(cmd[cmd.length - 1]),
        };
      }

      // Split apart the path, handing concatonated letters and numbers
      let pathParts = pathString
        .split(/[,\s]/)
        .reduce(function (parts: any[], part: string) {
          let match = part.match("([a-zA-Z])(.+)");
          if (match) {
            parts.push(match[1]);
            parts.push(match[2]);
          } else {
            parts.push(part);
          }

          return parts;
        }, []);

      // Group the commands with their arguments for easier handling
      let commands = pathParts.reduce(function (commands: any[][], part: any) {
        if (parseFloat(part) == part && commands.length) {
          commands[commands.length - 1].push(part);
        } else {
          commands.push([part]);
        }

        return commands;
      }, []);

      // The resulting commands, also grouped
      let resultCommands: any = [];

      if (commands.length > 1) {
        let startPoint = pointForCommand(commands[0]);

        // Handle the close path case with a "virtual" closing line
        let virtualCloseLine = null;
        if (commands[commands.length - 1][0] == "Z" && commands[0].length > 2) {
          virtualCloseLine = ["L", startPoint.x, startPoint.y];
          commands[commands.length - 1] = virtualCloseLine;
        }

        // We always use the first command (but it may be mutated)
        resultCommands.push(commands[0]);

        for (let cmdIndex = 1; cmdIndex < commands.length; cmdIndex++) {
          let prevCmd: any = resultCommands[resultCommands.length - 1];

          let curCmd: any = commands[cmdIndex];

          // Handle closing case
          let nextCmd: any = (curCmd == virtualCloseLine)
            ? commands[1]
            : commands[cmdIndex + 1];

          // Nasty logic to decide if this path is a candidite.
          if (nextCmd && prevCmd && (prevCmd.length > 2) && curCmd[0] == "L" && nextCmd.length > 2 && nextCmd[0] == "L") {
            // Calc the points we're dealing with
            let prevPoint = pointForCommand(prevCmd);
            let curPoint = pointForCommand(curCmd);
            let nextPoint = pointForCommand(nextCmd);

            // The start and end of the cuve are just our point moved towards the previous and next points, respectivly
            let curveStart, curveEnd;

            if (useFractionalRadius) {
              curveStart = moveTowardsFractional(curPoint, prevCmd.origPoint || prevPoint, radius);
              curveEnd = moveTowardsFractional(curPoint, nextCmd.origPoint || nextPoint, radius);
            } else {
              curveStart = moveTowardsLength(curPoint, prevPoint, radius);
              curveEnd = moveTowardsLength(curPoint, nextPoint, radius);
            }

            // Adjust the current command and add it
            adjustCommand(curCmd, curveStart);
            curCmd.origPoint = curPoint;
            resultCommands.push(curCmd);

            // The curve control points are halfway between the start/end of the curve and
            // the original point
            let startControl = moveTowardsFractional(curveStart, curPoint, .5);
            let endControl = moveTowardsFractional(curPoint, curveEnd, .5);

            // Create the curve 
            let curveCmd: any = ["C", startControl.x, startControl.y, endControl.x, endControl.y, curveEnd.x, curveEnd.y];
            // Save the original point for fractional calculations
            curveCmd.origPoint = curPoint;
            resultCommands.push(curveCmd);
          } else {
            // Pass through commands that don't qualify
            resultCommands.push(curCmd);
          }
        }

        // Fix up the starting point and restore the close path if the path was orignally closed
        if (virtualCloseLine) {
          let newStartPoint = pointForCommand(resultCommands[resultCommands.length - 1]);
          resultCommands.push(["Z"]);
          adjustCommand(resultCommands[0], newStartPoint);
        }
      } else {
        resultCommands = commands;
      }

      return resultCommands.reduce(function (str: any, c: any[]) { return str + c.join(" ") + " "; }, "");
    }
  }
}
